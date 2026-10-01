// THE BELT A PLAYER WEARS (v1.209.0, owner ruling 2026-09-30) — the gates.
//
// The rule (neural/src/belt.src.js): everyone starts in white; you wear the belt after the last
// belt, in an unbroken run from white, whose units are ALL proven (lessons + checkpoint);
// clearing black leaves you in black. It is a HIGH-WATER MARK (`belts.held`, v2 progress blob,
// MAX across devices) and was seeded once by a GRANDFATHER of every belt a player could see
// before (`belts.gf`). Game Knowledge stays a percentage and decides no belt.
//
// Every test drives the REAL class — `Component.prototype` with the bundle's prelude, the
// challenge definitions, engine and UI mixin in one scope, the way the build concatenates them —
// and asserts on what the app emitted or persisted. Nothing here restates the rule: the fixture
// curriculum is synthetic (5 belts × 2 units, one gi-only and one no-gi-only lesson per belt, so
// a ruleset flip really changes the answer) and the expectations are written from it by hand.
//
// MUTANTS (each run against this file, 2026-10-01; every one turns a NAMED test red):
//   M1  wornBelt() ignores `held` (ngWornBelt(flags, null))          → flip, failed card, curriculum edit
//   M2  ngWornBelt drops "a belt below held counts as proven"        → curriculum edit (stalled promotion)
//   M3  the `belts.held` MAX line removed from _mergeProgressFields  → stale device merge
//   M4  the merge keeps LOCAL `held` (local wins)                    → stale device merge
//   M5  _frontierBeltId drives the tab again                         → finished player wears black
//   M6  _recallInPlayNow reads the Game Knowledge band again         → readers follow the worn belt
//   M7  _noteBlackBelt reads gameScore().belt === "black" again      → readers follow the worn belt
//   M8  the email line written from gameScore().belt                 → readers follow the worn belt
//   M9  _checkpointAnswer no longer syncs                            → promotion needs every unit proven
//   M10 ngMergeBeltGrandfather keeps one side's mark                 → a pre-migration cloud is grandfathered again
//   M11 the grandfather drops the all-done → black reading           → grandfather
//   M12 the grandfather writes `gf` before the manifest is resident  → grandfather waits for the manifest
//   M16 the `gf` mark forces a save of its own                       → a passive boot saves nothing
//   M13 the dayLog merge drops the email's belt line                → the dayLog merge carries it
//   M14 setGiMode loses its POST-flip sync                           → flip (reload after a no-gi promotion)
//   M15 setGiMode loses its PRE-flip sync                            → flip (gi promotion arriving in no-gi)
// NON-KILL, recorded so nobody reads this file as covering it: the Settings lock is gated in e2e
// (recall-badge.spec.ts — its lock read from `gameScore().belt` again turns that journey red), not
// here: it renders through settings-ui.src.js and a DOM.
//
// Run: node --test tests/belt_worn.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { NG_BELT_IDS, ngWornBelt, ngMergeHeldBelt, ngMergeBeltGrandfather, ngBeltLineAhead } from "../neural/src/belt.src.js";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const SOURCE = [
  knowledgeSource,
  strip(rd("neural/src/progress-owner.src.js")),
  strip(rd("neural/src/lists-codec.src.js")),
  strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"),
  rd("neural/src/challenge-engine.src.js"),
  rd("neural/src/app.src.jsx"),
  rd("neural/src/challenge-ui.src.js"),
].join("\n");
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, NG_CHALLENGE_TRACKS, NG_CHALLENGE_TRACK_COLORS };")(
  class DCLogic {}, { createRef: () => ({ current: null }) });

// ── the fixture curriculum: 5 belts × 2 units; per belt one gi-only and one no-gi-only lesson ──
const L = (d, frames) => ({ nodeId: "Transitions/" + d, deckKey: d + "|Attacker", ...(frames ? { frames } : {}) });
function curriculum(edit) {
  const c = { belts: NG_BELT_IDS.map((id) => ({ id, name: id, units: [
    { id: "u1", lessons: [L(id + "-a"), L(id + "-b")], checkpoint: { cards: 2, pass: 2 } },
    { id: "u2", lessons: [L(id + "-c"), L(id + "-gi", ["gi"]), L(id + "-nogi", ["nogi"])], checkpoint: { cards: 2, pass: 2 } },
  ] })) };
  if (edit) edit(c);
  // the flat `weights` shape the app still reads: every lesson deck weighs the same, so the Game
  // Knowledge score is the mean mastery of the 25 decks and its bands are reachable by fixture
  c.weights = {};
  for (const b of c.belts) for (const u of b.units) for (const l of u.lessons) c.weights[l.deckKey] = 1;
  return c;
}
const DECKS = (() => {
  const d = {};
  for (const b of curriculum().belts) for (const u of b.units) for (const l of u.lessons) {
    d[l.deckKey] = { n: 3, cards: [0, 1, 2].map((i) => ({ q: l.deckKey + " question " + i, a: "answer " + i })) };
  }
  return d;
})();

function boot({ blob = {}, frame = "gi", cur = curriculum(), manifest = true } = {}) {
  const a = Object.create(M.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, _giMode: frame, beats: [], saves: 0,
    viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => { a.saves++; };
  a._flushSave = () => {};
  a.track = () => {};
  a.renderTutorial = () => {};
  a.renderChallengeCue = null;
  a.setEvent = () => {};
  a.setDeckOpen = () => {};
  a._applyLayers = () => {};
  a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {};
  a.weakSpots = () => null;
  a._progressCurrent = () => true;
  a._hydrateProgressBlob({ v: 2, belts: { won: {} }, ...blob });
  a._progressLoaded = true;
  if (manifest) a.flashcards = { decks: JSON.parse(JSON.stringify(DECKS)), manifest: true };
  a.curriculum = cur;
  a._onCurriculum();
  return a;
}
const beats = (a, name) => a.beats.filter((b) => b.beat === name);
const live = (l, frame) => (l.frames || ["gi", "nogi"]).includes(frame);
/** every lesson of the belt done (in `frame`, or in both) and every checkpoint passed — raw evidence, no sync */
function evidence(a, beltId, frame, { checkpoints = true } = {}) {
  const belt = a.curriculum.belts.find((b) => b.id === beltId);
  for (const u of belt.units) {
    for (const l of u.lessons) if (!frame || live(l, frame)) a.prep[l.deckKey] = 3;
    if (checkpoints) a.units[beltId + "/" + u.id] = { checkpoint: true, t: 1 };
  }
}
/** pass a unit's checkpoint through the REAL `_checkpointAnswer` (the quiz's last answer) */
function passCheckpoint(a, beltId, unitId) {
  const unit = a.curriculum.belts.find((b) => b.id === beltId).units.find((u) => u.id === unitId);
  a._checkpoint = { belt: beltId, unit, uk: beltId + "/" + unitId, picks: [{}], i: 0, firstTry: 0, pass: 1 };
  a._checkpointAnswer(true);
}
/** stage every card of the first `n` decks to `st` — a Game Knowledge score of n/25 at stage 3 */
function stageDecks(a, n, st) {
  for (const key of Object.keys(DECKS).slice(0, n)) {
    a.stage[key] = {};
    for (const c of DECKS[key].cards) a.stage[key][a.qhash(c.q)] = st;
  }
  a._publishKnowledge("test-stage");
}
/** what renderTabSubtitles() WROTE — read back from a stub node, never recomputed */
function tab(a) {
  const ex = { textContent: "" }, btn = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const ch = { innerHTML: "", closest: () => btn };
  a.viewToggleRef = { current: { querySelector: (s) => (s.includes("explore") ? ex : s.includes("challenges") ? ch : null) } };
  a.renderTabSubtitles();
  a.viewToggleRef = { current: null };
  const attr = (n) => (new RegExp(n + '="([^"]*)"').exec(ch.innerHTML) || [])[1];
  const out = { belt: attr("data-tab-belt"), stripes: attr("data-tab-stripes"), dye: (/--tb:([^;]+);/.exec(ch.innerHTML) || [])[1], aria: btn.attrs["aria-label"] };
  assert.ok(out.belt && out.stripes != null && out.dye, "the tab wrote a belt, stripes and a dye: " + ch.innerHTML);
  return out;
}

test("belt ids agree with the curriculum and the challenge tracks — one spelling, three files", () => {
  const authored = JSON.parse(rd("templates/curriculum.json")).belts.map((b) => b.id);
  assert.deepEqual(authored, [...NG_BELT_IDS]);
  assert.deepEqual(M.NG_CHALLENGE_TRACKS.map((t) => t.id), [...NG_BELT_IDS]);
});

test("promotion needs every unit proven — lessons alone never move the belt", () => {
  const a = boot();
  evidence(a, "white", "gi", { checkpoints: false });
  a._publishKnowledge("grade:test");
  assert.equal(a.wornBelt().id, "white", "every White lesson done, no checkpoint: still white");
  assert.equal(tab(a).stripes, "0");
  assert.equal(a.belts.held, undefined, "nothing persisted for lessons alone");
  // the frontier (navigation) has moved on — it is lessons-based, and it is not the belt
  assert.equal(a._frontierBeltId(), "blue");
  passCheckpoint(a, "white", "u1");
  assert.deepEqual([a.wornBelt().id, tab(a).stripes], ["white", "2"], "one of two units proven: two stripes");
  passCheckpoint(a, "white", "u2");
  assert.equal(a.wornBelt().id, "blue", "every White unit proven: blue");
  assert.equal(a.belts.held.id, "blue", "persisted at the checkpoint, not at the next repaint");
  assert.deepEqual(beats(a, "belt_promoted").map((b) => [b.belt, b.from, b.via]), [["blue", "white", "checkpoint"]]);
  assert.deepEqual([tab(a).belt, tab(a).stripes], ["blue", "0"]);
});

test("a finished player wears black with four stripes — on the tab, not white", () => {
  const a = boot();
  for (const id of NG_BELT_IDS) evidence(a, id);
  a._publishKnowledge("grade:test");
  assert.deepEqual(a.wornBelt(), { id: "black", rank: 4, done: 2, total: 2, stripes: 4 });
  const t = tab(a);
  assert.deepEqual([t.belt, t.stripes, t.dye], ["black", "4", M.NG_CHALLENGE_TRACK_COLORS.black]);
  assert.match(t.aria, /2 of 2 units proven on the black track, 4 stripes/);
  // the defect this replaces: the frontier falls back to the corridor's top when nothing is left.
  // It still does — for NAVIGATION — and it no longer dyes anything.
  assert.equal(a._frontierBeltId(), "white");
});

test("never lowered by a gi ↔ no-gi flip, in either direction", () => {
  const a = boot({ frame: "gi" });
  evidence(a, "white", "gi");
  a._publishKnowledge("grade:test");
  assert.equal(a.wornBelt().id, "blue");
  a.setGiMode("nogi");
  assert.equal(ngWornBelt(a._beltClearedFlags(), null).id, "white", "non-trivial: the rule alone says white in no-gi");
  assert.equal(a.wornBelt().id, "blue", "…and the belt stays blue");
  assert.equal(tab(a).belt, "blue");

  const b = boot({ frame: "nogi" });
  evidence(b, "white", "nogi");
  b._publishKnowledge("grade:test");
  assert.equal(b.wornBelt().id, "blue");
  b.setGiMode("gi");
  assert.equal(ngWornBelt(b._beltClearedFlags(), null).id, "white", "non-trivial: the rule alone says white in gi");
  assert.equal(b.wornBelt().id, "blue");

  // THE FLIP SEAMS PERSIST ON THEIR OWN. Every real evidence seam syncs first, so these write the
  // evidence RAW — nothing has persisted it — to make each side of setGiMode load-bearing.
  const c = boot({ frame: "gi" });
  evidence(c, "white", "gi");
  c.setGiMode("nogi");                                  // the PRE-flip sync persists gi's blue
  assert.equal(c.wornBelt().id, "blue", "pre-flip: gi's promotion survives arriving in no-gi");
  const d = boot({ frame: "gi" });
  evidence(d, "white", "nogi");                         // complete in no-gi only
  assert.equal(d.wornBelt().id, "white");
  d.setGiMode("nogi");                                  // the POST-flip sync persists no-gi's blue
  const reloaded = boot({ blob: d._progressBlob(), frame: "gi" });
  assert.equal(reloaded.wornBelt().id, "blue", "post-flip: no-gi's promotion survives a reload in gi");
});

test("never lowered by a failed card — the score falls, the belt does not", () => {
  // grandfathered from a blue Game Knowledge band: 10 of 25 decks recalled = 40%
  const a = boot({ blob: { stage: {} }, manifest: false });
  stageDecks(a, 10, 3);
  a.flashcards = { decks: JSON.parse(JSON.stringify(DECKS)), manifest: true };
  a.onFlashcardsReady();
  assert.equal(a.gameScore().belt, "blue");
  assert.deepEqual([a.belts.held.id, a.wornBelt().id, a._recallInPlayNow()], ["blue", "blue", true]);
  // fail every proven card through the REAL grade path
  for (const key of Object.keys(DECKS).slice(0, 10)) for (const c of DECKS[key].cards) {
    const r = a._gradeKnowledge(key, c, false, "recall", null, null, "deck");
    assert.equal(r.status, "applied");
  }
  assert.notEqual(a.gameScore().belt, "blue", "non-trivial: the failed cards dropped the band");
  assert.deepEqual([a.wornBelt().id, tab(a).belt, a._recallInPlayNow()], ["blue", "blue", true]);
});

test("never lowered by a curriculum edit — and the reopened belt never stalls the next one", () => {
  const a = boot();
  evidence(a, "white");
  a._publishKnowledge("grade:test");
  assert.equal(a.wornBelt().id, "blue");
  // the curriculum is provisional: White gains a lesson nobody has done
  a.curriculum = curriculum((c) => c.belts[0].units[0].lessons.push(L("white-new")));
  a._onCurriculum();
  assert.equal(a._beltClearedFlags()[0], false, "non-trivial: White is no longer proven");
  assert.equal(a.wornBelt().id, "blue", "…and the belt stays blue");
  evidence(a, "blue");
  a._publishKnowledge("grade:test");
  assert.equal(a.wornBelt().id, "purple", "proving Blue promotes even though White reopened below it");
});

test("never lowered by a stale device merging — belts.held is a MAX in the real _pullAndMerge", async () => {
  async function pull(local, cloud) {
    const a = boot({ blob: local });
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: cloud }) };
    Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
    assert.equal(await a._pullAndMerge(), true);
    return a;
  }
  const v2 = (belts, extra = {}) => ({ v: 2, prep: {}, belts: { won: {}, gf: 5, ...belts }, ...extra });
  // this device was promoted; the cloud is a stale device's older word
  let a = await pull(v2({ held: { id: "purple", t: 9 } }), v2({ held: { id: "blue", t: 3 } }));
  assert.deepEqual([a.belts.held.id, a.wornBelt().id], ["purple", "purple"]);
  assert.equal(a._progressBlob().belts.held.id, "purple", "and purple is what gets pushed back");
  // the other device was promoted: a belt held anywhere is held everywhere
  a = await pull(v2({ held: { id: "white", t: 9 } }), v2({ held: { id: "brown", t: 4 } }));
  assert.equal(a.wornBelt().id, "brown");
  // this device never held a belt: the old `belts` assign kept only LOCAL keys and dropped it
  a = await pull(v2({}), v2({ held: { id: "black", t: 4 } }));
  assert.equal(a.wornBelt().id, "black");
  // an unknown id is no belt, never a demotion of the other side
  a = await pull(v2({ held: { id: "blue", t: 9 } }), v2({ held: { id: "plaid", t: 1 } }));
  assert.equal(a.wornBelt().id, "blue");
  // a tie keeps the moment it was first earned
  assert.deepEqual(ngMergeHeldBelt({ id: "blue", t: 9 }, { id: "blue", t: 4 }), { id: "blue", t: 4 });
});

test("the grandfather: once, the max of every belt the player could see before v1.209.0", () => {
  // the old tab colour moved on lessons alone: every White lesson done, no checkpoint → it showed blue
  let a = boot({ blob: { prep: Object.fromEntries(curriculum().belts[0].units.flatMap((u) => u.lessons).map((l) => [l.deckKey, 3])) } });
  assert.deepEqual([a.belts.held.id, a.wornBelt().id], ["blue", "blue"]);
  assert.deepEqual(beats(a, "belt_promoted").map((b) => [b.belt, b.via]), [["blue", "grandfather"]]);
  assert.ok(a.belts.gf > 0, "the mark is written");
  // every lesson of every belt done: the old tab fell back to WHITE — read as the black it should have shown
  const all = {};
  for (const b of curriculum().belts) for (const u of b.units) for (const l of u.lessons) all[l.deckKey] = 3;
  a = boot({ blob: { prep: all } });
  assert.equal(a.wornBelt().id, "black");
  // the Game Knowledge band at migration: 16 of 25 decks recalled = 64% = purple
  a = boot({ blob: {}, manifest: false });
  stageDecks(a, 16, 3);
  a.flashcards = { decks: JSON.parse(JSON.stringify(DECKS)), manifest: true };
  a.onFlashcardsReady();
  assert.equal(a.wornBelt().id, "purple");
  // …and ONCE: after the mark, the score promotes nobody
  stageDecks(a, 25, 3);
  assert.equal(a.gameScore().belt, "black", "non-trivial: the score is black now");
  assert.equal(a.wornBelt().id, "purple", "the belt is not");
});

test("a passive boot with nothing to raise SAVES nothing; a raised belt saves at once", () => {
  // the mark rides the next save (harness-boot-inflight-write.spec.ts pins the same in a browser)
  const fresh = boot();
  assert.ok(fresh.belts.gf > 0, "marked in memory");
  assert.equal(fresh.saves, 0, "a fresh profile's boot wrote nothing it did not change");
  assert.equal(fresh._progressBlob().belts.gf, fresh.belts.gf, "…and the next save carries the mark");
  const raised = boot({ blob: { prep: Object.fromEntries(curriculum().belts[0].units.flatMap((u) => u.lessons).map((l) => [l.deckKey, 3])) } });
  assert.equal(raised.belts.held.id, "blue");
  assert.ok(raised.saves >= 1, "a grandfathered belt is persisted immediately");
});

test("the grandfather waits for the deck manifest before it writes its mark", () => {
  const a = boot({ blob: { stage: {} }, manifest: false });
  assert.equal(a.belts.gf, undefined, "curriculum alone: the band is not readable yet, no mark");
  stageDecks(a, 10, 3);
  a.flashcards = { decks: JSON.parse(JSON.stringify(DECKS)), manifest: true };
  a.onFlashcardsReady();
  assert.ok(a.belts.gf > 0);
  assert.equal(a.wornBelt().id, "blue", "the band read once the manifest is resident");
});

test("a pre-migration cloud is grandfathered again after the merge", async () => {
  const a = boot();
  assert.ok(a.belts.gf > 0 && !a.belts.held, "this device migrated, holding nothing");
  // a device still on the old rule: every White lesson done, no mark, no held
  const cloud = { v: 2, belts: { won: {} }, prep: Object.fromEntries(curriculum().belts[0].units.flatMap((u) => u.lessons).map((l) => [l.deckKey, 3])) };
  const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: cloud }) };
  Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
  assert.equal(await a._pullAndMerge(), true);
  assert.equal(a.wornBelt().id, "blue", "the old tab showed that device blue: grandfathered on the merged state");
  assert.ok(a.belts.gf > 0, "and the mark is back");
  assert.equal(ngMergeBeltGrandfather(5, undefined), undefined);
  assert.equal(ngMergeBeltGrandfather(5, 3), 3);
});

test("the readers follow the worn belt, never the score", () => {
  // a black Game Knowledge band on a white belt: nothing unlocks
  const a = boot();
  stageDecks(a, 25, 3);
  assert.equal(a.gameScore().belt, "black", "non-trivial: the score is black");
  assert.equal(a.wornBelt().id, "white");
  assert.equal(a._recallInPlayNow(), false, "timed recall in play: not from a score");
  a.noteCardAnswered();
  assert.ok(!(a.badges || {})["recall-in-play"], "the Recall Mode patch: not from a score");
  a.settings.emailDigest = true;
  a._noteKnowledgeCredit("white-a|Attacker");
  const day = a.dayLog[a._dayKey()];
  assert.deepEqual(day.b, ["white", 0, 2], "the email's belt line names the worn belt");
  // a blue belt with no score at all: recall in play is on
  const b = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 1 } } } });
  assert.equal(b.gameScore().score, 0);
  assert.equal(b._recallInPlayNow(), true);
  // promoted to black through the Challenges: the patch mints at once and flips its toggle on
  const c = boot();
  for (const id of NG_BELT_IDS) evidence(c, id);
  c._publishKnowledge("grade:test");
  assert.ok((c.badges || {})["recall-in-play"], "the Recall Mode patch minted at the promotion");
  assert.equal(c.get("recallInPlay", false), true);
  // the email's line rides the dayLog merge: the higher line is the later one
  assert.equal(ngBeltLineAhead(["blue", 0, 2], ["white", 2, 2]), true);
  assert.equal(ngBeltLineAhead(["white", 2, 2], ["blue", 0, 2]), false);
  assert.equal(ngBeltLineAhead(["plaid", 0, 2], null), false);
});

test("the dayLog merge carries the email's belt line", async () => {
  const today = boot()._dayKey();
  const a = boot({ blob: { dayLog: { [today]: { s: 10, k: ["white-a|Attacker"], b: ["white", 2, 2] } } } });
  const cloud = { v: 2, belts: { won: {}, gf: 5 }, dayLog: { [today]: { s: 5, k: ["white-b|Attacker"], b: ["blue", 0, 2] } } };
  const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: cloud }) };
  Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
  assert.equal(await a._pullAndMerge(), true);
  assert.deepEqual(a.dayLog[today].b, ["blue", 0, 2]);
  assert.equal(a.dayLog[today].s, 10, "the score keeps its own rule");
});
