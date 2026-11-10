// PROTECT THE STORED ACCOUNTS (v1.255.0, HIDE1B; the owner, 10 Nov: "i'd like to protect the current users, and not
// have them lose progress"). Hidden moves adds ONE field, `moves`, to the saved v2 blob. These tests drive the REAL
// class with the bundle's prelude (the order neural/build/build.mjs concatenates) on a realistic saved account:
//
//   1. OLD BLOB, NEW APP: a blob saved before v1.255.0 (no `moves`) loads with every number unchanged — prep, stage,
//      rec, srs, belts, units, the account menu's "Mastered N · X%", each deck's mastery and its odds bonus
//      (`stateBonus` = mastery + sharpness), the due count and today's Practice count — and a `moves` record, however
//      full, moves none of them.
//   3. TWO NEW DEVICES: the app's own merge (`_mergeProgressBlobs`) of two `moves` records gives the same cells in
//      either order of arrival: the later answer wins, a same-day tie goes to the smaller interval.
//   4. NOTHING REWRITTEN: every field the old blob carried is emitted byte-equal, under its own key; the only new key
//      is `moves`.
//
// Item 2 (a NEW blob in an OLD app) cannot run here — CI has only this tree's source. It was traced on v1.253.0's own
// code (origin/dev dc01c3d44) and is written up in the archive entry for v1.255.0.
//
// MUTANTS (2026-11-10, each turned the named test red):
//   hydrate files `moves` into `srs`                     → old blob: every number unchanged, nothing rewritten
//   `_gradeMove` also bumps `stage` for the state's deck → old blob: a full moves record moves no number
//   the merge ignores the cloud's `moves`                 → two new devices
//   the emit re-keys `srs` (deck keys lower-cased)        → old blob: nothing rewritten
//   `moves: {}` emitted for every account (review R4)     → old blob: no `moves` key, v1.254.0's keys in order
//   a grade cuts the row to four cells (review R5)         → R4 / R5
// NOT a gate here, by construction: dropping a field from `_progressBlob`'s explicit list survives, because the emit
// spreads the loaded blob's own fields first (`_progressExtras`), so an old field rides through either way.
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
].join("\n");
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component };")(class DCLogic {}, { createRef: () => ({ current: null }) });

const DAY = 20402;
// a fixed clock: `_epochDay` reads this, so due and "today" do not move with the calendar
globalThis.window = globalThis.window || {};
globalThis.window.__NG_EPOCH_DAY__ = DAY;

// ── a realistic account, the shape production holds: decks answered to every stage, a due backlog, a worn belt,
// lists, flow, days, settings — saved by v1.253.0, so no `moves` ──
const DECKS = {};
for (const k of ["Mount|Top", "Closed Guard|Bottom", "Armbar from Mount|Attacker", "Kimura from Mount|Attacker", "Side Control|Top", "Triangle Choke|Attacker"]) {
  DECKS[k] = { n: 4, cards: [0, 1, 2, 3].map((i) => ({ q: k + " — question " + i, a: "answer " + i })) };
}
const qh = (a, k, i) => a.qhash(DECKS[k].cards[i].q);
function oldBlob(a) {
  const stage = {}, srs = {};
  const st = { "Mount|Top": [3, 3, 2, 1], "Closed Guard|Bottom": [3, 3, 3, 3], "Armbar from Mount|Attacker": [2, 1, 0, 0], "Kimura from Mount|Attacker": [4, 3, 3, 2], "Side Control|Top": [1, 0, 0, 0] };
  for (const [k, v] of Object.entries(st)) { stage[k] = {}; v.forEach((s, i) => { if (s) stage[k][qh(a, k, i)] = s; }); }
  srs["Mount|Top"] = { [qh(a, "Mount|Top", 0)]: [DAY - 2, 3, DAY - 5], [qh(a, "Mount|Top", 1)]: [DAY + 4, 7, DAY - 3] };
  srs["Kimura from Mount|Attacker"] = { [qh(a, "Kimura from Mount|Attacker", 0)]: [DAY, 1, DAY - 1] };
  srs["Closed Guard|Bottom"] = { [qh(a, "Closed Guard|Bottom", 2)]: [DAY + 10, 14, DAY] };
  return {
    v: 2,
    prep: { "Mount|Top": 3, "Closed Guard|Bottom": 4, "Armbar from Mount|Attacker": 1, "Kimura from Mount|Attacker": 3 },
    rec: { "Mount|Top": 3, "Closed Guard|Bottom": 4, "Kimura from Mount|Attacker": 2 },
    stage, srs,
    units: { "white/u1": { checkpoint: true, t: 1762000000000 } },
    belts: { won: { white: { t: 1762000000000, moves: 7, byPoints: false } }, held: "white" },
    tut: { done: { "first-roll": 1 } },
    challenges: { "white-roll-3": 1 },
    badges: { "first-sub": 1762000000000 },
    coins: { total: 12 },
    lists: {},
    flow: {},
    explored: ["Positions/Mount", "Positions/Closed-Guard"],
    days: { "2026-11-08": 6, "2026-11-09": 11 },
    rollDays: { "2026-11-09": 3 },
    dayLog: {},
    settings: { dailyGoal: 25, masteryGold: true },
    settingsAt: { dailyGoal: 1762000000000, masteryGold: 1762000000001 },
    futureField: { kept: true },              // a field some later build wrote: carried, never touched
  };
}
function boot(blob) {
  const a = Object.create(M.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, beats: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  for (const k of ["_saveProgress", "_flushSave", "track", "renderTutorial", "setEvent", "setDeckOpen", "_applyLayers", "_gameValueChanged", "_rebuildRulesetMask"]) a[k] = () => {};
  a.weakSpots = () => null; a._progressCurrent = () => true;
  a._hydrateProgressBlob(JSON.parse(JSON.stringify(blob)));
  a._progressLoaded = true;
  a.flashcards = { decks: JSON.parse(JSON.stringify(DECKS)), manifest: true };
  // every deck weighs the same, so Game Knowledge is the mean mastery of the six (no belt curriculum: no belt sync runs)
  a.curriculum = { belts: [], weights: Object.fromEntries(Object.keys(DECKS).map((k) => [k, 1])) };
  return a;
}
const V1254_ORDER = ["v", "prep", "rec", "stage", "srs", "dayLog", "rollDays", "units", "belts", "tut", "challenges", "badges", "coins", "lists", "flow", "explored", "days", "settings", "settingsAt", "updatedAt"];
const numbers = (a) => {
  const gs = a.gameScore();
  return {
    prep: a.prep, stage: a.stage, rec: a.rec, srs: a.srs, belts: a.belts, units: a.units,
    menu: "Mastered " + a.masteredCount() + " · " + Math.round((gs && gs.score ? gs.score : 0) * 100) + "%",
    decks: Object.fromEntries(Object.keys(DECKS).map((k) => [k, { mastery: a.mastery(k), deckMastery: a.deckMastery(k), bonus: a.stateBonus(k) }])),
    due: a.dueCount(), today: a.practiceToday().done,
  };
};
// a full `moves` record: every kind of row, on states and moves that share nothing with the decks above
const MOVES = { "76/top": { "307": [DAY + 6, 7, DAY - 1, 1], "143": [DAY - 1, 3, DAY - 4, 1], "181": [DAY + 1, 1, DAY, 0] }, "76/bottom": { "e1a2b3c4d": [DAY + 3, 3, DAY - 2, 1] }, "35/bottom": { "512": [DAY, 1, DAY, 1] } };

test("old blob, new app: a pre-v1.255.0 account loads with every number unchanged, and nothing is rewritten", () => {
  const probe = boot({ v: 2 }), blob = oldBlob(probe);
  const a = boot(blob), n = numbers(a);
  // non-trivial: the fixture really carries mastery, a due backlog and today's work
  assert.equal(n.menu, "Mastered 2 · " + n.menu.split("· ")[1], "two decks at rec >= 3");
  assert.ok(n.decks["Closed Guard|Bottom"].deckMastery > 0.9 && n.decks["Side Control|Top"].deckMastery < 0.2, "the decks span the range: " + JSON.stringify(n.decks));
  assert.ok(n.due >= 2, "a due backlog");
  // every field the old blob carried is hydrated as saved…
  for (const k of ["prep", "rec", "stage", "srs", "units"]) assert.deepEqual(a[k], blob[k], k + " loads as saved");
  assert.deepEqual(a.belts.won, blob.belts.won, "belts.won loads as saved");
  assert.equal(a.belts.held, "white", "the worn belt");
  assert.deepEqual(a.moves, {}, "no `moves` in an old blob is an empty record, not an error");
  // …and saved back byte-equal, under its own key; the only key this version adds is `moves`
  const out = a._progressBlob();
  for (const k of Object.keys(blob)) {
    if (k === "belts" || k === "challenges") continue; // normalised by belt/challenge sync on every build, checked below
    assert.deepEqual(out[k], blob[k], "`" + k + "` is saved back unchanged");
  }
  assert.deepEqual(out.belts.won, blob.belts.won); assert.equal(out.belts.held, blob.belts.held);
  for (const c of Object.keys(blob.challenges)) assert.equal(out.challenges[c], blob.challenges[c], "challenge " + c + " kept");
  // review R4: an account that never graded a move saves NO `moves` key — the blob v1.254.0 saves for it, key for
  // key in the same order (V1254_ORDER is v1.254.0's `_progressBlob` literal, 21318b0c5, after the loaded fields)
  assert.ok(!("moves" in out), "no `moves` key for an account that never graded one");   // (belts.won carries its own `moves` count)
  assert.deepEqual(Object.keys(out), [...Object.keys(blob), ...V1254_ORDER.filter((k) => !(k in blob))], "v1.254.0's keys, in v1.254.0's order");
});

test("old blob, new app: a full `moves` record moves no number — no mastery, no menu figure, no odds bonus, no due or Practice count", () => {
  const probe = boot({ v: 2 }), blob = oldBlob(probe);
  const plain = numbers(boot(blob)), withMoves = numbers(boot({ ...blob, moves: MOVES }));
  assert.deepEqual(withMoves, plain);
  // and grading a move through the app's own path still moves none of them
  const a = boot({ ...blob, moves: MOVES });
  a.nodes = [{ id: "Positions/Mount", t: "Mount", ty: "positions" }, { id: "Submissions/Kimura/from-Mount", t: "Kimura from Mount", ty: "submissions" }];
  a._ordById = new Map([["Positions/Mount", 76], ["Submissions/Kimura/from-Mount", 307]]);
  a.siteIdOf = (id) => id; a._hmAt = 0; a.currentPos = 0; a.playerRole = "top";
  const card = { toggleAttribute() {} };
  a._gradeMove({ idx: 1, node: a.nodes[1] }, false, card);
  a._gradeMove({ idx: 1, node: a.nodes[1] }, true, card);
  assert.deepEqual(numbers(a), plain, "a graded move changes no existing number");
  assert.deepEqual(a.moves["76/top"]["307"].slice(1), [3, DAY, 1], "…and lands in `moves` alone");
});

test("R4 / R5: a graded account saves `moves`; a grade keeps a later build's tail on the row", () => {
  const a = boot({ v: 2, moves: { "76/top": { "307": [DAY - 1, 3, DAY - 4, 1, 5, 9] } } });
  a.nodes = [{ id: "Positions/Mount", t: "Mount", ty: "positions" }, { id: "Submissions/Kimura/from-Mount", t: "Kimura from Mount", ty: "submissions" }];
  a._ordById = new Map([["Positions/Mount", 76], ["Submissions/Kimura/from-Mount", 307]]);
  a.siteIdOf = (id) => id; a._hmAt = 0; a.currentPos = 0; a.playerRole = "top";
  a._gradeMove({ idx: 1, node: a.nodes[1] }, true, { toggleAttribute() {} });
  assert.deepEqual(a.moves["76/top"]["307"].slice(1), [7, DAY, 1, 5, 9], "the schedule moved on, and the tail rode along");
  assert.deepEqual(a._progressBlob().moves, a.moves, "a held cell is saved");
  const empty = boot({ v: 2, moves: { "76/top": {} } })._progressBlob();
  assert.ok(!("moves" in empty), "a `moves` with no cell (an earlier v1.255.0 build's {}) is not written back");
});

test("two new devices: the app's merge gives the same `moves` in either order of arrival", () => {
  const A = { v: 2, moves: { "76/top": { "307": [DAY + 6, 7, DAY - 1, 1], "143": [DAY + 1, 1, DAY, 0], "181": [DAY + 3, 3, DAY, 1] } } };
  const B = { v: 2, moves: { "76/top": { "307": [DAY + 1, 1, DAY, 0], "143": [DAY + 3, 3, DAY - 2, 1], "181": [DAY + 1, 1, DAY, 0] }, "35/bottom": { "512": [DAY, 1, DAY, 1] } } };
  const ab = boot({ v: 2 })._mergeProgressBlobs(A, B).moves, ba = boot({ v: 2 })._mergeProgressBlobs(B, A).moves;
  assert.deepEqual(ab, ba, "the order of arrival does not matter");
  assert.deepEqual(ab["76/top"]["307"], [DAY + 1, 1, DAY, 0], "the later answer wins: today's No takes yesterday's gold away");
  assert.deepEqual(ab["76/top"]["143"], [DAY + 1, 1, DAY, 0], "…on either device");
  assert.deepEqual(ab["76/top"]["181"], [DAY + 1, 1, DAY, 0], "a same-day tie goes to the smaller interval (the No)");
  assert.deepEqual(ab["35/bottom"], { "512": [DAY, 1, DAY, 1] }, "a cell one device alone holds is kept");
});
