// CARD1-S0-R2 (v1.301.5; the reader's re-read of PR #468, its R1): THE REAL HOST KEEPS THIS BROWSER'S MARKER. The grades a
// browser marks gone (`_pruneStaleGrades`) live in its own storage beside `<owner>:device` (progress-owner `goneRead` /
// `goneWrite`, local key `<owner>:gone`), never in the record. tests/stale_grades_kept.test.mjs runs each device on a stub;
// this file drives the REAL class through the REAL owner host (`ngProgressCreateHost`) on a memory storage, as
// tests/flow_device_per_browser.test.mjs does:
//   1. land, then reboot: the marker is read back, the stale grade stays hidden and the live one counts;
//   2. guest → account A → sign out → account B → guest: each owner keeps its own marker on this browser;
//   3. a storage that throws for the marker's key (read and write): nothing throws, and no live grade is hidden;
//   4. two tabs (the reader's R3): a tab writes only the deck it landed, over what the store holds now, so neither order
//      drops the other tab's deck (a mark kept; an unmark kept).
// MUTANTS (the reader's three of the real host, and the two-tab rule; each run alone, 4 of 4 clean before and after; the
// stub-based tests/stale_grades_kept.test.mjs stays green under every one of them, which is why this file exists):
//   V2 `goneRead`/`goneWrite` on one key for every owner → 2;  V3 `goneRead` answers {} always → 1, 2, 4;
//   V4 `goneWrite` stores nothing → 1, 2, 4;  R3 the tab's whole map written again → 4;
//   (CARD1-S2, the reader's last survivor) `_goneSave` stops adopting the map `goneWrite` hands back → 4, at "the adoption".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const SOURCE = [
  knowledgeSource,
  strip(rd("neural/src/gameplan-debt.src.js")),
  strip(rd("neural/src/progress-owner.src.js")),
  strip(rd("neural/src/lists-codec.src.js")),
  strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"),
  rd("neural/src/challenge-engine.src.js"),
  rd("neural/src/app.src.jsx"),
  rd("neural/src/challenge-ui.src.js"),
  strip(rd("neural/src/flow.src.js")),
].join("\n");
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngProgressCreateHost, ngProgressOwner, ngProgressLocalKey };")(class DCLogic {}, { createRef: () => ({ current: null }) });

globalThis.window = globalThis.window || {};
globalThis.window.__NG_EPOCH_DAY__ = 20402;
const clone = (x) => JSON.parse(JSON.stringify(x));

function memory(fail = () => false) {
  const rows = new Map();
  return { rows,
    getItem: (k) => { if (fail(k)) throw new Error("storage refused " + k); return rows.get(k) ?? null; },
    setItem: (k, v) => { if (fail(k)) throw new Error("storage refused " + k); rows.set(k, String(v)); },
    removeItem: (k) => { if (fail(k)) throw new Error("storage refused " + k); rows.delete(k); } };
}
// One BROWSER (or a tab of one, sharing `mem`): one owner host, the app instance it mounts (tests/flow_device_per_browser's)
function browser(cloud, mem = memory()) {
  let current = null, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true,
    pullNeural: async (id) => ({ userId: id, blob: cloud.has(id) ? clone(cloud.get(id)) : null }),
    pushNeural: async (b, id) => { cloud.set(id, clone(b)); return true; } };
  const host = M.ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(b) {
    const inst = new M.Component({}); current = inst; host.bind(inst, b);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = () => {}; inst.fx = () => {}; inst._announceArrival = () => {};
    inst._auth = () => facade; inst.isTest = () => true; inst._pushCloud = () => {};
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const get = () => current;
  const boot = async () => { await host.bootstrap(); return get(); };
  const signIn = async (id) => { identity = { id, email: "player@example.com" }; get()._applyUser(identity); const a = get(); a._applyUser(identity); await a._pullAndMerge(); return get(); };
  const signOut = () => { identity = null; get()._clearAuthUser(); return get(); };
  return { mem, get, boot, signIn, signOut };
}
const GUEST = M.ngProgressOwner(), A = M.ngProgressOwner("A"), B = M.ngProgressOwner("B");
const Q = (a, s) => a.qhash(s);
/** the deck as it lands: its cards in place (n of them, the manifest's count), then the prune */
const land = (a, D, qs) => { const cards = qs.map((q) => ({ q, a: "an answer" })); a.flashcards = a.flashcards || { decks: {} }; a.flashcards.decks[D] = { n: cards.length, cards }; a._pruneStaleGrades(D, cards); };
/** the deck as a reboot finds it: in the manifest, its cards not loaded */
const unloaded = (a, D, n) => { a.flashcards = a.flashcards || { decks: {} }; a.flashcards.decks[D] = { n }; };
/** a reload: a new host over the same storage (a host does not remount the instance it holds) */
const reload = async (cloud, mem) => browser(cloud, mem).boot();
/** grades in this instance's own record, saved through the host */
const grade = (a, D, rows) => { a.stage = a.stage || {}; a.stage[D] = Object.assign(a.stage[D] || {}, rows); a._saveProgress(); };

test("R2 · 1: the real host: land, then reboot: the marker is read back, the stale grade hidden, the live one counted", async () => {
  const cloud = new Map(), b = browser(cloud);
  let a = await b.boot();
  const D = "D|Top";
  grade(a, D, { [Q(a, "q1")]: 3, [Q(a, "gone")]: 3 });
  land(a, D, ["q1", "q2"]);
  const stored = JSON.parse(b.mem.getItem(M.ngProgressLocalKey(GUEST, "gone")));
  assert.deepEqual(Object.keys(stored[D]), [Q(a, "gone")], "the marker is in this browser's store, under the guest");
  assert.equal("stageGone" in a._progressBlob(), false, "and not in the record");
  a = await reload(cloud, b.mem);                                 // a reboot: a new instance reads the store
  unloaded(a, D, 2);
  assert.ok(Q(a, "gone") in a.stage[D], "premise: the grade is kept in the record");
  assert.equal(a._gradeGone(D, Q(a, "gone")), true, "the marker read back (V3, V4)");
  assert.equal(a._gradeGone(D, Q(a, "q1")), false, "the live grade is not marked");
  assert.equal(a.deckMastery(D), 0.5, "the stub counts the live grade alone (with the marker lost it reads 1)");
});

test("R2 · 2: guest → account A → sign out → account B → guest: each owner keeps its own marker on this browser", async () => {
  const cloud = new Map(), b = browser(cloud);
  let g = await b.boot();
  const D1 = "One|Top", D2 = "Two|Top";
  grade(g, D1, { [Q(g, "kept1")]: 2, [Q(g, "gone1")]: 3 });
  land(g, D1, ["kept1", "other1"]);
  assert.equal(g._gradeGone(D1, Q(g, "gone1")), true, "premise: the guest marked gone1");
  let a = await b.signIn("A");
  assert.equal(a._gradeGone(D1, Q(a, "gone1")), false, "account A does not read the guest's marker (V2)");
  grade(a, D2, { [Q(a, "kept2")]: 2, [Q(a, "gone2")]: 3 });
  land(a, D2, ["kept2", "other2"]);
  assert.equal(a._gradeGone(D2, Q(a, "gone2")), true, "A marks its own");
  g = b.signOut();
  assert.equal(g._gradeGone(D1, Q(g, "gone1")), true, "the guest's marker is still the guest's");
  assert.equal(g._gradeGone(D2, Q(g, "gone2")), false, "and holds nothing of A's (V2)");
  const bb = await b.signIn("B");
  assert.deepEqual([bb._gradeGone(D1, Q(bb, "gone1")), bb._gradeGone(D2, Q(bb, "gone2"))], [false, false], "account B starts with none (V2)");
  g = b.signOut();
  assert.equal(g._gradeGone(D1, Q(g, "gone1")), true, "back to the guest: its own again");
  const keys = [GUEST, A, B].map((o) => b.mem.getItem(M.ngProgressLocalKey(o, "gone")));
  assert.ok(keys[0] && keys[1] && !keys[2], "one store per owner: the guest's and A's, none for B");
});

test("R2 · 3: a storage that throws for the marker's key: nothing throws, and no live grade is hidden", async () => {
  const cloud = new Map(), b = browser(cloud, memory((k) => k.endsWith(":gone")));
  let a = await b.boot();
  const D = "D|Top";
  grade(a, D, { [Q(a, "q1")]: 3, [Q(a, "gone")]: 3 });
  assert.doesNotThrow(() => land(a, D, ["q1", "q2"]), "a landing whose marker cannot be written");
  assert.equal(a._gradeGone(D, Q(a, "q1")), false, "the live grade is not hidden");
  a = await reload(cloud, b.mem);                                 // a reboot whose marker cannot be read (it would throw here)
  unloaded(a, D, 2);
  assert.equal(a._gradeGone(D, Q(a, "q1")), false, "the live grade is not hidden");
  assert.ok(a.deckMastery(D) >= 0.5, "the live grade counts (the stale one may too, until the deck lands: never a loss)");
});

test("R2 · 4: two tabs: a tab writes only the deck it landed, so neither order drops the other tab's deck", async () => {
  const cloud = new Map(), mem = memory();
  const D = "D|Top", E = "E|Top", F = "F|Top";
  // one record, saved by a first tab: live and stale grades in three decks
  const t0 = browser(cloud, mem); const a = await t0.boot();
  grade(a, D, { [Q(a, "d1")]: 3, [Q(a, "goneD")]: 3 }); grade(a, E, { [Q(a, "e1")]: 3, [Q(a, "goneE")]: 3 }); grade(a, F, { [Q(a, "f1")]: 3, [Q(a, "goneF")]: 3 });
  // a mark kept: T1 and T2 both open, T1 lands D, then T2 (its map read before T1's write) lands E
  const t1 = browser(cloud, mem), t2 = browser(cloud, mem);
  const a1 = await t1.boot(), a2 = await t2.boot();
  land(a1, D, ["d1", "d2"]);
  land(a2, E, ["e1", "e2"]);
  assert.equal(a2._gradeGone(D, Q(a2, "goneD")), true, "T2 adopts the map its write hands back: T1's mark on D is T2's now (the adoption)");
  let r = await reload(cloud, mem);
  assert.deepEqual([r._gradeGone(D, Q(r, "goneD")), r._gradeGone(E, Q(r, "goneE"))], [true, true], "both tabs' decks are marked (the whole-map write kept E only)");
  // an unmark kept: T2 holds D marked; T1 lands D with goneD's question back (unmarks); then T2 writes (it lands F)
  land(a1, D, ["d1", "goneD"]);
  land(a2, F, ["f1", "f2"]);
  assert.equal(a2._gradeGone(D, Q(a2, "goneD")), false, "and T1's unmark too, at T2's next write: T2 counts goneD's grade again (the adoption)");
  r = await reload(cloud, mem);
  assert.equal(r._gradeGone(D, Q(r, "goneD")), false, "the unmark stays (T2's older copy of D is not written back)");
  assert.deepEqual([r._gradeGone(E, Q(r, "goneE")), r._gradeGone(F, Q(r, "goneF"))], [true, true], "and E's and F's marks stay");
});
