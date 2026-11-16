// THE BELT A PLAYER WEARS (v1.211.0, owner ruling 2026-09-30) — the gates.
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
//   M6  the carry-over reads the Game Knowledge band again           → readers follow the worn belt (until v1.283.0 the
//       switch's reader `_recallInPlayNow`, deleted with the switch; the carry's fact is read here as `carried`)
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
//   OPEN-M1..M14 (U163 c, v1.270.0): beltUnlocked back to the worn rank (M1) or to `rank >= worn` (M14) · timed recall
//       from the worn belt again (M2) · the patch's mint flips the switch again (M3) · no carry-over (M4) · `openAt`
//       merged local-wins (M6) · the carry writes the switch again (M9, the bug of the read of PR #404) · a stored value
//       read only when a carry exists (M10) · the save drops the carry's fact (M11) · the fact not consulted (M12) · no
//       clamp of a future held stamp (M13) — each named at the assertion it turns red (the tests at the end of this
//       file). M5 (the carry overwrites a stored value) has no code left to mutate since OPEN2: the carry writes no value.
// NON-KILL, recorded so nobody reads this file as covering it: Settings renders through settings-ui.src.js and a DOM, so it
// is gated in e2e, not here. The "Recall mode (in play)" row was a lock until v1.270.0, a switch for everyone until v1.283.0,
// and is gone since (its key kept): e2e/journeys/answer-mode.spec.ts pins the Answer mode row that replaced its job.
//
// Run: node --test tests/belt_worn.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { NG_BELT_IDS, ngWornBelt, ngMergeHeldBelt, ngMergeBeltGrandfather, ngBeltLineAhead, ngMergeOpenAt } from "../neural/src/belt.src.js";

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
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, NG_CHALLENGE_TRACKS, NG_CHALLENGE_TRACK_COLORS, NG_BELT_ROW_COLORS };")(
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
/** what the DRAWER wrote (v1.276.0, ruled STAGE2-GO 3: one belt in the drawer): the "Master the game" row's belt
 *  (`_paintBeltRow`) and the Path row's own words (`renderTabSubtitles`), read back from stub nodes, never recomputed.
 *  UNTIL v1.276.0 this read a belt drawn UNDER THE PATH ROW (`[data-path-belt] .ng-tab-belt`, its `data-tab-belt`,
 *  `data-tab-stripes` and `--tb` dye) and the row's "N stripes" tail; that belt moved to the new row (same id, same
 *  stripes: the held level is raised to the Path's level by the same `_syncBelt`, so with no number they agree), and the
 *  Path row now says its course's units in words, which this checks against the Path's own `wornBelt()`. */
function tab(a) {
  const btn = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const ch = { textContent: "", closest: () => btn };
  const row = { innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const box = { querySelector: (s) => (s.includes("data-belt-row") ? row : null) };
  a.drillRef = { current: { querySelector: (s) => (s.includes("challenges") ? ch : s.includes("data-explore-stats") ? box : null) } };
  a.renderTabSubtitles(); a._paintBeltRow();
  a.drillRef = { current: null };
  const attr = (n) => (new RegExp(n + '="([^"]*)"').exec(row.innerHTML) || [])[1];
  const out = { belt: attr("data-belt"), stripes: attr("data-stripes"), dye: (/--belt:([^;]+);/.exec(row.innerHTML) || [])[1], aria: btn.attrs["aria-label"], words: ch.textContent };
  assert.ok(out.belt && out.stripes != null && out.dye, "the drawer row wrote a belt, stripes and a dye: " + row.innerHTML);
  const w = a.wornBelt();
  assert.equal(ch.textContent, w.total > 0 ? w.done + " of " + w.total + " units" : "", "the Path row says its course's units in words");
  return out;
}

// THE CARRY-OVER'S FACT, as the app keeps it since v1.283.0: stamped (`_syncBelt`) and merged (OR) exactly as before, and
// read by nothing in the app (the answer mode decides a roll's format). Until v1.283.0 these assertions read
// `_recallInPlayNow()`, whose carry branch was exactly this; its other branch, a stored `recallInPlay`, is asserted kept
// and deciding nothing in "timed recall: the answer mode decides ...".
const carried = (a) => a._recallCarry === true || a._recallCarryLive();

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

// v1.276.0 R1 (finding 3, ruled): this test was named "a finished player wears black with four stripes — on the tab, not
// white". The drawer now draws black with its red bar and no stripes (table a has no levels above black, and no degrees on
// black); the Path's own rule still gives four, asserted first below. The name says what the body pins.
test("a finished player wears black, never white: the Path's rule gives four stripes, the drawer draws black with no stripes", () => {
  const a = boot();
  for (const id of NG_BELT_IDS) evidence(a, id);
  a._publishKnowledge("grade:test");
  assert.deepEqual(a.wornBelt(), { id: "black", rank: 4, done: 2, total: 2, stripes: 4 }, "the Path's own rule: black, four stripes");
  const t = tab(a);
  // v1.276.0: the drawer row wears black on table a, where black has NO stripes (level 20). Before, the Path row's belt
  // drew black with the Path's four stripes: ["black", "4", NG_CHALLENGE_TRACK_COLORS.black]. The Path's rule is above.
  assert.deepEqual([t.belt, t.stripes, t.dye], ["black", "0", M.NG_BELT_ROW_COLORS.black]);
  assert.equal(t.words, "2 of 2 units");
  // before: /2 of 2 units proven on the black track, 4 stripes/ (the aria named the stripes of the belt drawn under it)
  assert.match(t.aria, /^Path: 2 of 2 units proven on the black track$/);
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
  assert.deepEqual([a.belts.held.id, a.wornBelt().id, carried(a)], ["blue", "blue", true]);
  // fail every proven card through the REAL grade path
  for (const key of Object.keys(DECKS).slice(0, 10)) for (const c of DECKS[key].cards) {
    const r = a._gradeKnowledge(key, c, false, "recall", null, null, "deck");
    assert.equal(r.status, "applied");
  }
  assert.notEqual(a.gameScore().belt, "blue", "non-trivial: the failed cards dropped the band");
  assert.deepEqual([a.wornBelt().id, tab(a).belt, carried(a)], ["blue", "blue", true]);
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

test("the grandfather: once, the max of every belt the player could see before v1.211.0", () => {
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
  assert.equal(carried(a), false, "timed recall in play: not from a score");
  a.noteCardAnswered();
  assert.ok(!(a.badges || {})["recall-in-play"], "the Recall Mode patch: not from a score");
  a.settings.emailDigest = true;
  a._noteKnowledgeCredit("white-a|Attacker");
  const day = a.dayLog[a._dayKey()];
  assert.deepEqual(day.b, ["white", 0, 2], "the email's belt line names the worn belt");
  // a blue belt with no score at all: recall in play is on (since U163 c, v1.270.0, by the carry-over: this blue was held
  // before the open rule ran on the account — see "the carry-over" below)
  const b = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 1 } } } });
  assert.equal(b.gameScore().score, 0);
  assert.equal(carried(b), true);
  // promoted to black through the Challenges: the patch mints at once. Until v1.270.0 it also flipped its toggle on
  // (`get("recallInPlay")` was asserted true here); since U163 c it leaves the switch alone (the rule's start is seeded at
  // 1000 so this promotion is unambiguously under it)
  const c = boot({ blob: { openAt: 1000 } });
  for (const id of NG_BELT_IDS) evidence(c, id);
  c._publishKnowledge("grade:test");
  assert.ok((c.badges || {})["recall-in-play"], "the Recall Mode patch minted at the promotion");
  assert.equal(c.get("recallInPlay", false), false, "U163 c: the mint switches nothing on");
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

// EVERYTHING OPENS (U163 c, owner, 13 Nov; v1.270.0). Until then this test was P1-B, "future progression actions cannot
// use selected/folded tracks as an entitlement": on a blue belt it asserted that a stored black selection fell back to
// blue, a stored black fold stayed shut, and selecting purple, folding brown open and starting a black lesson, checkpoint
// or capstone were all refused. The owner's rule reverses each of those: the belt only shows. The Path's own evidence
// gates are not belt locks and still hold (a checkpoint needs its lessons, a capstone its checkpoints).
// Mutant OPEN-M1 (beltUnlocked back to `rank <= wornBelt().rank`) turns this test red at its first assertion.
test("U163 c: every section, lesson, checkpoint and capstone is open, whatever belt you wear", () => {
  const a = boot({ blob: { belts: { held: { id: "blue", t: 1 }, gf: 1, won: {} } } });
  a.renderExplorer = () => {}; a.showCenter = () => {}; a.rollFromPosition = () => {}; a._seatMember = (i) => i;
  a.studyFromSession = () => {}; a.locateNode = () => {}; a.hydrateDecks = () => Promise.resolve();
  a.nodeForKey = () => -1; a._lessonNodeIdx = () => -1; a.nodes = []; a._checkpointShow = () => {};
  a.settings.challengeSelectedTrack = "black";
  a.settings.challengeOpenSections = { black: true };
  assert.equal(a.selectedChallengeTrack(), "black", "a stored later selection stands");
  assert.equal(a._beltSectionOpen("black"), true, "a stored later fold stands");
  assert.equal(a._beltSectionOpen("brown"), false, "a section never opened is folded (presentation, not a lock)");
  a.selectChallengeTrack("purple");
  assert.equal(a.settings.challengeSelectedTrack, "purple", "a later belt can be selected");
  a._setBeltSectionOpen("brown", true);
  assert.equal(a.settings.challengeOpenSections.brown, true, "a later belt can be unfolded");
  const black = a.curriculum.belts[4], unit = black.units[0];
  a.openLessonStudy(unit.lessons[0], unit, black);
  assert.ok(a._session && a._session.keys.includes(unit.lessons[0].deckKey), "a black lesson opens on a blue belt");
  a.startCheckpoint("black", unit);
  assert.equal(a._checkpoint, undefined, "its own evidence gate stands: the unit's lessons first");
  for (const l of unit.lessons) a.prep[l.deckKey] = 3;
  a.startCheckpoint("black", unit);
  assert.equal(a._checkpoint && a._checkpoint.uk, "black/u1", "with its lessons done, a black checkpoint starts on a blue belt");
  a._checkpoint = null;
  black.test = { startNodeId: "x", maxMoves: 9 };
  a.startBeltTest("black");
  assert.equal(a._beltTest, undefined, "its own evidence gate stands: every unit first");
  evidence(a, "black");
  a.startBeltTest("black");
  assert.equal(a._beltTest && a._beltTest.beltId, "black", "with every unit proven, the black capstone starts on a blue belt");
  assert.equal(a.beltUnlocked("plaid"), false, "a name that is not a belt opens nothing");
  // the old P1-B's lower bound, kept: a belt below the one worn stays reachable (mutant OPEN-M14, `rank >= worn`, red here)
  a.selectChallengeTrack("white");
  assert.equal(a.selectedChallengeTrack(), "white", "earlier earned sections remain reachable");
  assert.equal(a.wornBelt().id, "blue", "the belt itself is untouched: black's units proven out of order promote nothing");
});

// TIMED RECALL IN A ROLL WAS A SWITCH (U163 c, v1.270.0 to v1.282): no belt switched it on, the patch at black included.
// SINCE v1.283.0 THE ANSWER MODE DECIDES (the app's `_answerMode` / `_cardAsksMc`, rulings R1/R2): Auto, the default for
// nothing stored, asks multiple choice until a card reaches stage 2 and front and back from there, in Practice and in a
// roll; Front Back cards ("classic") asks every card front and back; Multiple choice ("mc") none. The old switch
// `recallInPlay` is KEPT (stored, stamped, synced: a settings key can never be deleted, CLAUDE.md 6.6) and decides nothing.
// Mutants: a roll reading `recallInPlay` again (the stored Off below goes front-and-back-less), Auto's line moved off 2, a
// stored "mc" ignored, OPEN-M3 (the mint flips the switch on again): each turns a named assertion here red.
test("timed recall: the answer mode decides; the kept switch and a belt earned under the open rule decide nothing", () => {
  const asks = (a, st) => { a.stage = { "k|Top": { [a.qhash("q")]: st } }; return a._cardAsksMc("k|Top", { q: "q" }) ? "mc" : "fb"; };
  const w = boot();
  assert.equal(w.settings.mcMode, undefined, "precondition: nothing stored");
  assert.deepEqual([0, 1, 2, 3, 4].map((st) => asks(w, st)), ["mc", "mc", "fb", "fb", "fb"], "Auto: multiple choice until stage 2");
  for (const v of [true, false]) {
    w.set("recallInPlay", v);
    assert.equal(w.settings.recallInPlay, v, "the old switch is still stored: " + v);
    assert.deepEqual([asks(w, 1), asks(w, 2)], ["mc", "fb"], "and decides nothing: " + v);
  }
  w.set("mcMode", "mc");
  assert.deepEqual([asks(w, 0), asks(w, 2), asks(w, 4)], ["mc", "mc", "mc"], "a stored Multiple choice: always");
  w.set("mcMode", "classic");
  assert.deepEqual([asks(w, 0), asks(w, 2)], ["fb", "fb"], "a stored Front Back cards: always");
  // blue earned AFTER the rule began on this account: no carry, nothing written
  const b = boot({ blob: { openAt: 1000, belts: { won: {}, gf: 5, held: { id: "blue", t: 5000 } } } });
  assert.equal(carried(b), false, "OPEN-M2: a blue belt earned under the open rule carries nothing");
  assert.equal(b.settings.recallInPlay, undefined, "and nothing is written for it");
  // black reached through the Challenges under the open rule: the patch mints, the switch stays where it was
  const c = boot({ blob: { openAt: 1000 } });
  for (const id of NG_BELT_IDS) evidence(c, id);
  c._publishKnowledge("grade:test");
  assert.equal(c.wornBelt().id, "black");
  assert.ok((c.badges || {})["recall-in-play"], "the Recall Mode patch still mints at black");
  assert.equal(c.settings.recallInPlay, undefined, "OPEN-M3: the mint no longer flips the switch on");
  assert.equal(carried(c), false);
});

// THE CARRY-OVER (OPEN1, rebuilt in OPEN2): a player whose roll questions were timed recall because of their belt keeps
// that, as the account's own fact (`recallCarry`, OR across devices), and NOTHING but the player's press writes the switch.
// Until OPEN2 the carry wrote `recallInPlay: true` stamped at this device's `openAt`, and this test pinned that stamp
// ("stamped at the rule's start, so any later choice wins the merge"): the line that pinned the bug, since a device that
// stamped before its pull beat another device's later Off (the read of PR #404, finding 1). It is replaced by "the carry
// never writes the switch" and by the two-device test below, whose fake cloud holds the Off.
// Mutants: OPEN-M4 (no carry) and OPEN-M9 (the carry writes the switch again, stamped at this device's `openAt`), M10 (a
// stored value read only when a carry exists), M11 (the save drops the fact), M12 (the fact not consulted: live only),
// M13 (no clamp of a future held stamp) each turn a named assertion below red.
test("the carry-over: a belt held before the open rule keeps timed recall as the account's fact; the switch is never written", () => {
  // blue earned at t=1000, before this account ever ran the open rule (no `openAt` stored)
  const a = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } } });
  assert.ok(a._openAt > 1000, "the rule's first run is stamped on this account");
  assert.equal(carried(a), true, "OPEN-M4: their roll questions stay timed recall");
  assert.equal(a._recallCarry, true, "kept as the account's fact");
  assert.equal(a.settings.recallInPlay, undefined, "OPEN-M9: the carry never writes the switch: only a press does");
  assert.equal(a.saves, 0, "a passive boot saves nothing: the stamp and the fact ride the next save");
  const blob = a._progressBlob();
  assert.deepEqual([blob.openAt, blob.recallCarry, blob.settings.recallInPlay], [a._openAt, true, undefined], "the next save carries both, and no switch");
  // a promotion under the rule re-stamps the held belt; the fact keeps the carry (the rule began at 5000 on this account)
  const p = boot({ blob: { openAt: 5000, belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } } });
  assert.equal(p._recallCarry, true, "precondition: carried at its first sync");
  for (const id of ["white", "blue"]) evidence(p, id);
  p._publishKnowledge("grade:test");
  assert.equal(p.belts.held.id, "purple");
  assert.ok(p.belts.held.t > p._openAt, "precondition: the held stamp is now after the rule began");
  assert.equal(carried(p), true, "OPEN-M12: a promotion under the rule cannot take the carry back");
  // turning it off sticks, and a press is the switch's only writer
  a.set("recallInPlay", false);
  a._syncBelt("test");
  assert.equal(a.settings.recallInPlay, false, "off stays off (kept; since v1.283.0 it decides nothing)");
  assert.equal(carried(a), true, "and the fact is never cleared");
  // a stored value is the player's own and decides, either way (a black-patch holder who had turned it off, or on)
  for (const v of [false, true]) {
    const h = boot({ blob: { settings: { recallInPlay: v }, settingsAt: { recallInPlay: 500 }, belts: { won: {}, gf: 5, held: { id: "black", t: 1000 } } } });
    assert.equal(h.settings.recallInPlay, v, "the stored " + v + " is kept");
    assert.equal(h._settingsAt.recallInPlay, 500, "and its stamp");
    assert.equal(carried(h), true, "the stored " + v + " beside a carried black: both kept, neither decides (v1.283.0)");
  }
  // a stored On on a belt with no carry is never lowered
  const on = boot({ blob: { settings: { recallInPlay: true }, settingsAt: { recallInPlay: 500 }, belts: { won: {}, gf: 5, held: { id: "white", t: 1000 } } } });
  assert.equal(on.settings.recallInPlay, true, "OPEN-M10: a stored On is never lowered (kept, read by nothing)");
  // a white belt carries nothing
  const w = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "white", t: 1000 } } } });
  assert.equal(carried(w), false);
  assert.equal(w._recallCarry, false);
});

test("the carry-over's clock: a held stamp in this device's future is clamped to its now before the comparison", () => {
  // the belt was earned on a device whose clock ran ahead; this device's first run of the rule stamps its own now
  const a = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: Date.now() + 1e9 } } } });
  assert.ok(a._openAt > 0 && a._openAt < a.belts.held.t, "precondition: the stamp lies after this device's openAt");
  assert.equal(carried(a), true, "OPEN-M13: clamped to now, the belt predates the rule here");
  assert.equal(a._recallCarry, true);
  // named edge, not fixable from stamps: a fast-clock stamp on an account whose rule began earlier still reads as after it
  const b = boot({ blob: { openAt: 4000, belts: { won: {}, gf: 5, held: { id: "blue", t: Date.now() + 1e9 } } } });
  assert.equal(carried(b), false);
});

test("two devices: a stale device that syncs before its pull never brings Recall Mode back over the Off chosen on the other", async () => {
  async function pull(a, cloud) {
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: JSON.parse(JSON.stringify(cloud)) }) };
    Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
    assert.equal(await a._pullAndMerge(), true);
    a._syncBelt("test");
    return a;
  }
  // device A: blue since t=1000, ran the rule at openAt 10,000, carried, then the player turned it Off (stamped now, after 10,000)
  const A = boot({ blob: { openAt: 10000, belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } } });
  assert.equal(carried(A), true, "precondition: A carried it");
  A.set("recallInPlay", false);
  const cloudA = A._progressBlob();
  assert.ok(cloudA.settingsAt.recallInPlay > cloudA.openAt, "precondition: the cloud holds Off, stamped after the cloud's openAt");
  // device B: the phone, used before the update: its local copy holds the same blue and nothing else; it runs `_syncBelt`
  // (curriculum and manifest land) BEFORE its pull resolves, as a real boot does
  const B = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } } });
  assert.ok(B._openAt >= cloudA.settingsAt.recallInPlay, "precondition: B's own stamp is later than A's Off");
  assert.equal(B.settings.recallInPlay, undefined, "B before its pull wrote no switch");
  // order 1: B pulls A
  await pull(B, cloudA);
  assert.equal(B._openAt, 10000, "B learns the account's earlier stamp");
  assert.equal(B.settings.recallInPlay, false, "OPEN-M9: B after pulling A's Off: Off");
  // then A pulls B's push
  await pull(A, B._progressBlob());
  assert.equal(A.settings.recallInPlay, false, "OPEN-M9: A after pulling B: still Off");
  // order 2: B's stale copy reaches A first (a copy saved before B's pull), then B pulls the result
  const B2 = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } } });
  const A2 = boot({ blob: cloudA });
  await pull(A2, B2._progressBlob());
  assert.equal(A2.settings.recallInPlay, false, "A after pulling B's stale copy: Off");
  await pull(B2, A2._progressBlob());
  assert.equal(B2.settings.recallInPlay, false, "B after pulling that: Off");
  // a stored On on the cloud is never lowered by a device with no carry and no choice
  const onCloud = { v: 2, openAt: 10000, settings: { recallInPlay: true }, settingsAt: { recallInPlay: 20000 }, belts: { won: {}, gf: 5, held: { id: "white", t: 1000 } } };
  const W = await pull(boot({ blob: { belts: { won: {}, gf: 5, held: { id: "white", t: 1000 } } } }), onCloud);
  assert.equal(W.settings.recallInPlay, true, "a stored On survives a device that never chose");
});

test("the carry's fact travels: an offline first run meets the cloud later, OR across devices, and openAt merges as the earlier", async () => {
  async function pull(a, cloud) {
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: JSON.parse(JSON.stringify(cloud)) }) };
    Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
    assert.equal(await a._pullAndMerge(), true);
    a._syncBelt("test");
    return a;
  }
  // B played offline on the old version and earned blue at t=3000 on its own clock; its first run of the rule, offline,
  // carries it. The account's rule had begun at 2000 on device A (white there), so A's live reading says "after the rule".
  const B = boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 3000 } } } });
  assert.equal(B._recallCarry, true, "precondition: B's offline first run established the fact");
  const A = boot({ blob: { openAt: 2000, belts: { won: {}, gf: 5, held: { id: "white", t: 1 } } } });
  await pull(A, B._progressBlob());
  assert.equal(A._openAt, 2000, "openAt merges as the earlier stamp");
  assert.equal(A._recallCarryLive(), false, "precondition: A's live reading alone would not carry it");
  assert.deepEqual([A._recallCarry, carried(A), A.settings.recallInPlay], [true, true, undefined], "OPEN-M11: the fact travels to A, and no switch is written");
  // the same offline B meets a cloud that already holds the player's Off: Off
  const cloudOff = { v: 2, openAt: 2000, settings: { recallInPlay: false }, settingsAt: { recallInPlay: 2500 }, belts: { won: {}, gf: 5, held: { id: "white", t: 1 } } };
  const B2 = await pull(boot({ blob: { belts: { won: {}, gf: 5, held: { id: "blue", t: 3000 } } } }), cloudOff);
  assert.equal(B2.settings.recallInPlay, false, "an Off already on the cloud is kept on the offline device");
  // the earlier stamp is what gets pushed back, and the helper's own cases
  const C = await pull(boot({ blob: { openAt: 9000, belts: { won: {}, gf: 5 } } }), { v: 2, openAt: 3000, belts: { won: {}, gf: 5, held: { id: "blue", t: 4000 } } });
  assert.equal(C._openAt, 3000, "OPEN-M6: the earlier stamp wins, never local-wins");
  assert.equal(carried(C), false, "blue earned at 4000, under the rule begun at 3000: not carried");
  assert.equal(C._progressBlob().openAt, 3000);
  assert.deepEqual([ngMergeOpenAt(0, 5), ngMergeOpenAt(7, 5), ngMergeOpenAt("x", 5), ngMergeOpenAt(0, 0)], [5, 5, 5, 0]);
});

// D4 of the delta read of PR #404: "only ever true" held by convention, not by code. Mutants: OPEN-M19 (hydrate reads any
// truthy value, the reader's X3), OPEN-M20 (no explicit OR in the merge: the local-wins extras let a local `false` beat
// the cloud's `true`), OPEN-M21 (the fact decided only in the call that first stamps `openAt`, a plausible "fix"
// for the stale device that would lose a belt only the cloud held). The last case is the old merge test's first,
// removed in OPEN2 without a word and restored here: a new device that stamped before its pull carries a blue held only on
// the cloud.
test("the carry's fact holds by code: only `true` counts, a local copy never beats the cloud's `true`, and a device that stamped before its pull carries the cloud's blue", async () => {
  async function pull(a, cloud) {
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: JSON.parse(JSON.stringify(cloud)) }) };
    Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
    assert.equal(await a._pullAndMerge(), true);
    a._syncBelt("test");
    return a;
  }
  const x = boot({ blob: { recallCarry: "yes", openAt: 4000, belts: { won: {}, gf: 5, held: { id: "white", t: 1 } } } });
  assert.deepEqual([x._recallCarry, carried(x)], [false, false], "OPEN-M19: only `true` counts as the fact");
  const y = await pull(boot({ blob: { recallCarry: false, openAt: 4000, belts: { won: {}, gf: 5, held: { id: "white", t: 1 } } } }),
    { v: 2, openAt: 4000, recallCarry: true, belts: { won: {}, gf: 5 } });
  assert.deepEqual([y._recallCarry, y._progressBlob().recallCarry, carried(y)], [true, true, true], "OPEN-M20: the cloud's `true` wins over a local `false`");
  const z = await pull(boot({ blob: { openAt: 9000, belts: { won: {}, gf: 5 } } }), { v: 2, belts: { won: {}, gf: 5, held: { id: "blue", t: 4000 } } });
  assert.equal(z._openAt, 9000, "the cloud never ran the rule: this device's stamp stands");
  assert.deepEqual([carried(z), z._recallCarry], [true, true], "OPEN-M21: a device that stamped before its pull carries the blue only the cloud held, and writes it down");
});

// v1.283.0 (rulings R2, SET1-GO; U190 c): THREE ROWS LEAVE THE SCREEN AND THEIR KEYS STAY IN STORAGE. "Recall mode (in play)"
// (`recallInPlay`), "Show flashcards on pages" (`quizOnPages`) and Focus (`focus`, the owner 16 Nov: "Take the row off the
// screen") left Settings, and the carried-belt fact (`recallCarry`) decides nothing; a
// settings key can never be deleted (CLAUDE.md 6.6: the per-key merge has no tombstone, so a pruned key comes back from the
// first device that still holds it), so each must come through load, save and both directions of the merge exactly as it
// was stored, value and stamp. And the new default writes nothing: a blob with no `mcMode` saves with no `mcMode`.
// Mutants: a load or a save that drops one of the four (as a "cleanup" would), a merge that skips a key the app no longer
// reads, and a boot that writes the default `mcMode` each turn a named assertion here red.
test("the retired keys round-trip untouched through load, save and merge; a missing mcMode stays missing", async () => {
  async function pull(a, cloud) {
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: JSON.parse(JSON.stringify(cloud)) }) };
    Object.assign(a, { _auth: () => facade, _authUserId: "u1", _authEpoch: 0, _authDisposed: false, _progressLocalOnly: false });
    assert.equal(await a._pullAndMerge(), true);
    return a;
  }
  const stored = { v: 2, recallCarry: true, openAt: 3000,
    settings: { recallInPlay: false, quizOnPages: false, focus: "converge" },
    settingsAt: { recallInPlay: 1111, quizOnPages: 2222, focus: 3333 },
    belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } };
  const kept = (a) => [a.settings.recallInPlay, a.settings.quizOnPages, a.settings.focus, a._settingsAt.recallInPlay, a._settingsAt.quizOnPages, a._settingsAt.focus, a._recallCarry === true];
  const want = [false, false, "converge", 1111, 2222, 3333, true];
  const a = boot({ blob: JSON.parse(JSON.stringify(stored)) });
  assert.deepEqual(kept(a), want, "load keeps all four, value and stamp");
  assert.equal("mcMode" in a.settings, false, "and writes no mcMode: Auto is the reader's default");
  const out = a._progressBlob();
  assert.deepEqual([out.settings.recallInPlay, out.settings.quizOnPages, out.settings.focus, out.settingsAt.recallInPlay, out.settingsAt.quizOnPages, out.settingsAt.focus, out.recallCarry],
    want, "save keeps all four");
  assert.equal("mcMode" in out.settings, false, "a save writes no mcMode");
  const fresh = await pull(boot(), out);
  assert.deepEqual(kept(fresh), want, "a device that never had them gets them from the cloud");
  const again = await pull(a, { v: 2, settings: {}, settingsAt: {}, belts: { won: {}, gf: 5 } });
  assert.deepEqual(kept(again), want, "a cloud without them takes nothing away (no tombstone)");
  assert.equal("mcMode" in again.settings, false);
  // a newer press from another device still wins its own key, as for any setting (per-key last writer wins)
  const newer = await pull(boot({ blob: JSON.parse(JSON.stringify(stored)) }), { v: 2, settings: { recallInPlay: true }, settingsAt: { recallInPlay: 9999 }, belts: { won: {}, gf: 5 } });
  assert.deepEqual([newer.settings.recallInPlay, newer._settingsAt.recallInPlay], [true, 9999]);
});
