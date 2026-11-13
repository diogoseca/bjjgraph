// THE BELT IN THE DRAWER ROW (v1.276.0, STAGE2; owner U159 a, U160 a, U162 a, U169 c; the orchestrator's rulings STAGE2-GO).
//
// The drawer's "Master the game" row wears the belt: the HELD LEVEL (`belts.lvl = {n, t}`, rating.src.js), which rises to
// the higher of itself, the Path's own level as read now and the number's level, and never falls; one value for both
// rulesets. The number (rounded down) is shown only when its reading is final; a number below the floor of what is worn
// prints a second line. A level the player's OWN number reaches is the one promotion: a silent beat and one analytics line.
//
// Every test drives the REAL class (the bundle's prelude, the challenge mixin and app.src.jsx in one scope, as the build
// concatenates them) and asserts on what it painted, stored or merged; the pure module is asserted where it is the law.
// The fixture curriculum is synthetic (5 belts × 2 units; per belt one gi-only and one no-gi-only lesson, so a ruleset
// flip really lowers the Path's stripes). The live-check tests read this worktree's own emitted payload.
//
// MUTANTS (tests/artifacts/belt_row_mutants.mjs applies each to the source, runs this file and the guest-join file, and
// restores it; every one turns the NAMED test red):
//   BELT-M1  the held level's merge keeps the LOCAL value (the line in `_mergeProgressFields` taken out) → "two devices"
//   BELT-M2  a lower number lowers the held level (`_raiseLevel` sets any other level)    → "a lower number"
//   BELT-M3  the first run seeds 0, not the Path's level                                  → "the first run seeds"
//   BELT-M4  the seed taken from the number alone (no raise from the Path in `_syncBelt`) → "the seed is the higher"
//   BELT-M5  the number shown while not final (`ngRatingRow` ignores `final`)             → "shown only when final"
//   BELT-M6  the number rounded to nearest                                                → "shown only when final"
//   BELT-M7  the merge takes the LOWER level                                              → "the guest join"
//   BELT-M8  `ngProgressPracticeKey` keeps `belts.lvl`                  → guest_join_safety.test.mjs 20 "says nothing"
//   BELT-M9  the dip's line printed when there is no dip (at the floor itself)            → "the dip's second line"
//   BELT-M10 the row wears the Path's level alone (the held level ignored)                → "a ruleset flip"
//   BELT-M11 the row repaints from a live read, not the reading it asked for              → "never moves by itself"
//   BELT-M12 the promotion fires on every final reading above the HELD level, not above what is worn → "a promotion"
//   BELT-M13 a reopen fetches again after a check that landed: BOTH guards dropped (`_askBeltRow`'s reading in hand and
//            `ratingCheck`'s ok guard; either alone holds the claim, so each alone survives by design) → "a reopen"
//   BELT-M14 a reopen after a failed check never tries again (`ratingCheck` reuses a kept failure) → "a reopen"
//   BELT-M15 a drawer opened before the game was in never asks again (`_syncBelt`'s ask dropped) → "a drawer opened before"
//   BELT-M16 the row paints a reading taken in the other ruleset (R1, finding 1)          → "a reading taken in the other ruleset"
//   BELT-M17 a gi/no-gi flip with the drawer shown does not ask again (R1, finding 1)      → "a ruleset flip with the drawer shown"
//   BELT-M18 a level another tab already saved fires again (R1, finding 2a)                → "two tabs"
//   BELT-M19 an account fires before its first pull (R1, finding 2b)                       → "an account before its first pull"
//   BELT-M20 after the pull it fires though the cloud brought the level (R1, finding 2b)   → "an account before its first pull"
//   BELT-M21 the pull never fires a held-back promotion (`_pullAndMerge`'s call dropped)  → "an account before its first pull"
//
// Run: node --test tests/belt_row.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { NG_BELT_IDS } from "../neural/src/belt.src.js";
import { ngRatingRow, ngRatingMergeHeld, ngRatingHeld, ngRatingPathLevel, ngRatingLevelFloor } from "../neural/src/rating.src.js";
import { ngProgressGuestMerge } from "../neural/src/progress-owner.src.js";
import { ratingApp, ratingFixture } from "./_rating_fixture.mjs";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const build = (app) => new Function("DCLogic", "React", [
  knowledgeSource,
  strip(rd("neural/src/progress-owner.src.js")),
  strip(rd("neural/src/lists-codec.src.js")),
  strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"),
  rd("neural/src/challenge-engine.src.js"),
  app,
  rd("neural/src/challenge-ui.src.js"),
].join("\n") + "\nreturn { Component, NG_BELT_ROW_COLORS };")(class DCLogic {}, { createRef: () => ({ current: null }) });
const APP = rd("neural/src/app.src.jsx");
const M = build(APP);
// THE OLDER CLIENT's merge: this source with the held level's two merge lines taken out, which is exactly the merge of
// `belts` every client before v1.276.0 runs (it keeps only LOCAL keys of `belts`, then sets `held` and `gf`). Each line
// must be found once, or the older client is not what it claims to be.
const LVL_MERGE = [
  "        const lvl = ngRatingMergeHeld((this.belts || {}).lvl, (cloud.belts || {}).lvl);\n",
  "        if (lvl) this.belts.lvl = lvl; else delete this.belts.lvl;\n",
];
// Built when its test runs, not at load: a mutant of the merge line (BELT-M1) must turn ITS test red ("two devices"), not
// fail this whole file at its first line.
const oldClient = () => {
  for (const l of LVL_MERGE) assert.equal(APP.split(l).length, 2, "the held level's merge line is in the source once: " + l.trim());
  return build(LVL_MERGE.reduce((s, l) => s.replace(l, ""), APP));
};

// ── the fixture curriculum (as tests/belt_worn.test.mjs): 5 belts × 2 units; per belt one gi-only, one no-gi-only lesson ──
const L = (d, frames) => ({ nodeId: "Transitions/" + d, deckKey: d + "|Attacker", ...(frames ? { frames } : {}) });
function curriculum() {
  const c = { belts: NG_BELT_IDS.map((id) => ({ id, name: id, units: [
    { id: "u1", lessons: [L(id + "-a"), L(id + "-b")], checkpoint: { cards: 2, pass: 2 } },
    { id: "u2", lessons: [L(id + "-c"), L(id + "-gi", ["gi"]), L(id + "-nogi", ["nogi"])], checkpoint: { cards: 2, pass: 2 } },
  ] })) };
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
const clone = (v) => JSON.parse(JSON.stringify(v));

function boot({ blob = {}, frame = "gi", Mod = M, reading = null } = {}) {
  const a = Object.create(Mod.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, _giMode: frame, beats: [], saves: 0, tracked: [],
    viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => { a.saves++; };
  a._flushSave = () => { a.flushes = (a.flushes || 0) + 1; };
  a.track = (e, p) => { a.tracked.push([e, p]); };
  a.renderTutorial = () => {};
  a.renderChallengeCue = null;
  a.setEvent = () => {};
  a.setDeckOpen = () => {};
  a._applyLayers = () => {};
  a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {};
  a.weakSpots = () => null;
  a._progressCurrent = () => true;
  a._hydrateProgressBlob({ v: 2, belts: { won: {} }, ...clone(blob) });
  a._progressLoaded = true;
  a.flashcards = { decks: clone(DECKS), manifest: true };
  a.curriculum = curriculum();
  a._onCurriculum();
  if (reading) setReading(a, reading);
  return a;
}
/** the reading the row asks for: `rating()` answers it, `ratingCheck()` lands it (the law is pinned by rating.test.mjs) */
function setReading(a, r) { a.rating = () => r; a.ratingCheck = () => Promise.resolve(r); }
const ok = (points, frame = "gi") => ({ status: "ok", final: true, points, frame });
/** units proven, raw evidence: every lesson live in `frame` done and each named unit's checkpoint passed */
function prove(a, beltId, frame, units) {
  const belt = a.curriculum.belts.find((b) => b.id === beltId);
  for (const u of belt.units) {
    if (!units.includes(u.id)) continue;
    for (const l of u.lessons) if ((l.frames || ["gi", "nogi"]).includes(frame)) a.prep[l.deckKey] = 3;
    a.units[beltId + "/" + u.id] = { checkpoint: true, t: 1 };
  }
  a._publishKnowledge("grade:test");
}
/** what `_paintBeltRow` WROTE, read back from a stub node: never recomputed */
function row(a) {
  const el = { innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const box = { querySelector: (s) => (s.includes("data-belt-row") ? el : null) };
  a.drillRef = { current: { querySelector: (s) => (s.includes("data-explore-stats") ? box : null) } };
  a._paintBeltRow();
  a.drillRef = { current: null };
  const attr = (n) => (new RegExp(n + '="([^"]*)"').exec(el.innerHTML) || [])[1];
  const text = (h) => h.replace(/<[^>]+>/g, "").replace(/ /g, " ").trim();
  const lines = [...el.innerHTML.matchAll(/<div( data-belt-dip="1")?>(.*?)<\/div>/g)].filter((m) => !/ng-dr-rank/.test(m[2])).map((m) => text(m[2])).filter(Boolean);
  return { state: el.attrs["data-belt-state"], belt: attr("data-belt"), stripes: attr("data-stripes"), number: attr("data-belt-number"),
    aria: attr("aria-label"), lines, dip: /data-belt-dip/.test(el.innerHTML), slots: (/<span>(.*?)<\/span><em>/.exec(el.innerHTML) || [])[1] };
}
const beats = (a, name) => a.beats.filter((b) => b.beat === name);

test("the first run seeds the held level with the Path's level: no stripe a player wears today is lost", () => {
  const a = boot();
  assert.deepEqual([ngRatingHeld(a.belts.lvl).n, a.saves], [0, 0], "a bare first run seeds 0 and writes nothing (it rides the next save)");
  prove(a, "white", "gi", ["u1"]);
  assert.equal(a.wornBelt().stripes, 2, "precondition: the Path gives white, two stripes");
  assert.equal(a.belts.lvl.n, 2, "BELT-M3: seeded from the Path's level");
  assert.deepEqual([row(a).belt, row(a).stripes], ["white", "2"]);
  // an account from before this version: a held blue (Path rule) and stripes, no level yet
  const b = boot({ blob: { belts: { won: {}, held: { id: "blue", t: 5 }, gf: 6 }, units: { "blue/u1": { checkpoint: true, t: 1 } },
    prep: { "blue-a|Attacker": 3, "blue-b|Attacker": 3 } } });
  assert.deepEqual([b.wornBelt().id, b.wornBelt().stripes, b.belts.lvl.n], ["blue", 2, 7], "BELT-M3: blue, two stripes held at its first run");
});

test("the seed is the higher of what you wear and the number's level, stored (not only drawn)", async () => {
  const a = boot({ reading: ok(1200) });   // the number's own level: white, one stripe (1192)
  prove(a, "blue", "gi", ["u1"]);
  a.belts.held = { id: "blue", t: 1 }; a._syncBelt("test");
  assert.equal(a.belts.lvl.n, 7, "BELT-M4: the Path's blue two-stripe level is STORED, not only drawn");
  await a._askBeltRow();
  assert.equal(a.belts.lvl.n, 7, "a number below it does not take it");
  assert.deepEqual(row(a).lines, ["216 to your 3rd stripe · 280 to purple", "184 under your 2nd stripe · stripes stay"]);
});

test("a ruleset flip that lowers the Path's stripes leaves the row's (one level for both rulesets)", () => {
  const a = boot({ frame: "gi" });
  prove(a, "white", "gi", ["u1", "u2"]);
  prove(a, "blue", "gi", ["u2"]);   // blue's second unit in gi only: its no-gi lesson is not done
  assert.deepEqual([a.wornBelt().id, a.wornBelt().stripes, a.belts.lvl.n], ["blue", 2, 7], "precondition: blue, two stripes, held");
  a.setGiMode("nogi");
  assert.deepEqual([a.wornBelt().id, a.wornBelt().stripes], ["blue", 0], "non-trivial: in no-gi the Path gives blue with no stripe");
  assert.deepEqual([row(a).belt, row(a).stripes, a.beltWorn().level], ["blue", "2", 7], "BELT-M10: the row keeps both stripes");
  a.setGiMode("gi");
  assert.equal(a.belts.lvl.n, 7, "and the stored level never moved");
});

test("a lower number never lowers the held level; the dip says so", async () => {
  const a = boot({ blob: { belts: { won: {}, lvl: { n: 9, t: 3 } } }, reading: ok(1322) });
  await a._askBeltRow();
  assert.deepEqual(a.belts.lvl, { n: 9, t: 3 }, "BELT-M2: blue four stripes stays held, its stamp untouched");
  const r = row(a);
  assert.deepEqual([r.belt, r.stripes, r.number], ["blue", "4", "1322"]);
  assert.deepEqual(r.lines, ["158 to purple", "126 under your 4th stripe · stripes stay"]);
  assert.equal(beats(a, "level_reached").length, 0, "nothing fires for a dip");
});

test("the number is shown only when final, rounded DOWN; until then the belt held and a placeholder", async () => {
  const a = boot({ blob: { belts: { won: {}, lvl: { n: 7, t: 3 } } } });
  let land;
  a.rating = () => ({ status: "checking", final: false, points: null });
  a.ratingCheck = () => new Promise((r) => { land = r; });
  const p = a._askBeltRow();
  const w = row(a);
  assert.deepEqual([w.state, w.number, w.belt, w.stripes, w.lines], ["wait", "", "blue", "2", []], "BELT-M5: waiting: the belt held, no number, no line");
  land({ status: "ok", final: true, points: 1412.97, frame: "gi" });
  await p;
  const r = row(a);
  assert.deepEqual([r.state, r.number], ["ok", "1412"], "BELT-M6: rounded DOWN (1412.97 shows 1412)");
  assert.deepEqual(r.lines, ["4 to your 3rd stripe · 68 to purple"], "the distances add up from the number shown");
  // a failed or never-final answer stays quiet: the belt, no number, no line
  const b = boot({ blob: { belts: { won: {}, lvl: { n: 4, t: 3 } } }, reading: { status: "unchecked", reason: "fetch-failed", final: false, points: null } });
  await b._askBeltRow();
  assert.deepEqual([row(b).state, row(b).number, row(b).lines, row(b).belt, row(b).stripes], ["wait", "", [], "white", "4"]);
  // the module says the same as the row: not final, no number, whatever the points
  assert.equal(ngRatingRow(7, { status: "ok", final: false, points: 1400 }).number, null, "BELT-M5 (module)");
});

test("the number never moves by itself: the row paints the reading it asked for, until the next ask", async () => {
  const a = boot({ reading: ok(1300) });
  await a._askBeltRow();
  assert.equal(row(a).number, "1300");
  setReading(a, ok(1500));   // a pull or a new day moved the live reading while the drawer is open
  assert.equal(row(a).number, "1300", "BELT-M11: a repaint keeps the number on screen");
  await a._askBeltRow();     // the next open (or coming back to the list)
  assert.equal(row(a).number, "1500");
});

test("the dip's second line: only below the floor of what is worn, never at it", async () => {
  const a = boot({ blob: { belts: { won: {}, lvl: { n: 7, t: 3 } } }, reading: ok(ngRatingLevelFloor(7)) });
  await a._askBeltRow();
  assert.deepEqual([row(a).number, row(a).dip, row(a).lines], ["1384", false, ["32 to your 3rd stripe · 96 to purple"]], "BELT-M9: at the floor, no dip");
  setReading(a, ok(1322)); await a._askBeltRow();
  assert.deepEqual(row(a).lines, ["94 to your 3rd stripe · 158 to purple", "62 under your 2nd stripe · stripes stay"], "the drawn dip, word for word");
  // a belt line with no stripe: the second line names the belt
  const b = boot({ blob: { belts: { won: {}, lvl: { n: 10, t: 3 } } }, reading: ok(1470) });
  await b._askBeltRow();
  assert.deepEqual(row(b).lines, ["42 to your 1st stripe · 170 to brown", "10 under purple · your belt stays"]);
});

test("rows for a brand-new visitor and the top of the scale", async () => {
  const a = boot({ reading: { status: "empty", final: true, points: null, frame: "gi" } });
  await a._askBeltRow();
  const r = row(a);
  assert.deepEqual([r.state, r.belt, r.stripes, r.number, r.lines], ["none", "white", "0", "", ["Answer a few cards to get your number"]]);
  assert.equal(r.slots, "<s></s><u></u><u></u><u></u>", "no stripe yet: the first is the empty slot");
  assert.equal(r.aria, "White belt, 0 stripes");
  const top = boot({ reading: ok(2000) });
  await top._askBeltRow();
  assert.deepEqual([row(top).belt, row(top).stripes, row(top).number, row(top).lines, row(top).slots, row(top).aria], ["black", "0", "2000", ["The top of the scale"], "", "Black belt"]);
  const near = boot({ blob: { belts: { won: {}, lvl: { n: 20, t: 3 } } }, reading: ok(1900.5) });
  await near._askBeltRow();
  assert.deepEqual([row(near).number, row(near).lines], ["1900", ["100 to the top of the scale"]], "1900.5 shows 1900: 100 to go");
});

test("a promotion by the number: once, saved, one silent beat and one analytics line; nothing on a merge", async () => {
  const a = boot({ blob: { belts: { won: {}, lvl: { n: 7, t: 3 } } }, reading: ok(1416.4) });
  const flushes = a.flushes || 0;
  await a._askBeltRow();
  assert.equal(a.belts.lvl.n, 8, "raised to blue, three stripes");
  assert.deepEqual(beats(a, "level_reached").map((b) => [b.level, b.belt, b.stripes, b.from, b.rating]), [[8, "blue", 3, 7, 1416]]);
  assert.deepEqual(a.tracked.filter(([e]) => e === "neural_level_reached"), [["neural_level_reached", { belt: "blue", stripes: 3, rating: 1416 }]]);
  assert.equal(a.flushes, flushes + 1, "written at once, with the level (R1: a flush, so another tab reads it at once)");
  await a._askBeltRow(); await a._askBeltRow();
  assert.equal(beats(a, "level_reached").length, 1, "BELT-M12: never twice for one level");
  // a level that arrives by a merge fires nothing, and neither does the next read below it
  a._mergeProgressFields({ v: 2, belts: { won: {}, lvl: { n: 12, t: 9 } } });
  await a._askBeltRow();
  assert.deepEqual([a.belts.lvl.n, beats(a, "level_reached").length], [12, 1]);
  // the Path's own rise fires nothing either (it rides `_syncBelt`)
  const b = boot();
  prove(b, "white", "gi", ["u1"]);
  assert.deepEqual([b.belts.lvl.n, beats(b, "level_reached").length], [2, 0]);
  // a number above the HELD level but not above what the Path gives now is not a promotion (BELT-M12)
  const c = boot({ reading: ok(1200) });   // the number's level 1; the Path gives 2, held is 2 after the sync
  prove(c, "white", "gi", ["u1"]);
  c.belts.lvl = { n: 0, t: 1 };   // held below the Path (a merge from a device that never synced the Path)
  await c._askBeltRow();
  assert.equal(beats(c, "level_reached").length, 0, "the Path already gives it: nothing fires");
});

test("two devices in both orders, against a fake cloud that HOLDS a level lower and higher than theirs", () => {
  const blob = (n, t) => ({ v: 2, belts: { won: {}, lvl: { n, t } } });
  const dev = (n, t) => boot({ blob: blob(n, t) });
  const lvl = (app) => app._progressBlob().belts.lvl;
  const pull = (app, cloud) => { const next = app._mergeProgressBlobs(app._progressBlob(), cloud); app._hydrateProgressBlob(next); return next; };
  for (const order of ["A then B", "B then A"]) {
    for (const cloudN of [5, 12]) {
      let cloud = blob(cloudN, 50);
      const A = dev(9, 100), B = dev(3, 200);
      const steps = order === "A then B" ? [A, B, A, B] : [B, A, B, A];
      for (const d of steps) cloud = pull(d, cloud);
      const want = Math.max(9, cloudN);
      assert.deepEqual([lvl(A).n, lvl(B).n, cloud.belts.lvl.n], [want, want, want], "BELT-M1: " + order + ", cloud at " + cloudN + ": every copy holds the higher");
    }
  }
  // a tie keeps the earlier stamp, whichever side holds it
  const T = dev(6, 300);
  assert.deepEqual(pull(T, blob(6, 40)).belts.lvl, { n: 6, t: 40 });
  assert.deepEqual(ngRatingMergeHeld({ n: 6, t: 40 }, { n: 6, t: 300 }), ngRatingMergeHeld({ n: 6, t: 300 }, { n: 6, t: 40 }));
  // a malformed value is no value: never a guess, never a demotion of the other side
  assert.deepEqual(ngRatingMergeHeld({ n: "9" }, { n: 4, t: 1 }), { n: 4, t: 1 });
  assert.equal(ngRatingMergeHeld({ n: 21 }, null), undefined);
});

test("the guest join takes the higher level, whichever side holds it", () => {
  const app = boot();
  const merge = (l, g) => app._mergeProgressBlobs(l, g);
  const blob = (n) => ({ v: 2, prep: { "white-a|Attacker": 1 }, belts: { won: {}, lvl: { n, t: n } } });
  assert.equal(ngProgressGuestMerge(merge, blob(4), blob(9)).belts.lvl.n, 9, "BELT-M7: the guest's higher level joins");
  assert.equal(ngProgressGuestMerge(merge, blob(9), blob(4)).belts.lvl.n, 9, "BELT-M7: a guest's lower level never lowers the account's");
  assert.equal(ngProgressGuestMerge(merge, { v: 2, belts: { won: {} } }, blob(3)).belts.lvl.n, 3, "an account without one takes the guest's");
});

test("an older client (the merge before v1.276.0) carries the value through load and save, keeps its own on a merge; a current pull restores it", () => {
  const OLD = oldClient();
  const old = boot({ Mod: OLD, blob: { belts: { won: {}, lvl: { n: 6, t: 7 } } } });
  assert.deepEqual(old._progressBlob().belts.lvl, { n: 6, t: 7 }, "load and save: carried through untouched");
  // its own merge keeps LOCAL keys of `belts`: a cloud's higher level is dropped in favour of its own lower one
  old._mergeProgressFields({ v: 2, belts: { won: {}, lvl: { n: 11, t: 9 } } });
  assert.deepEqual(old.belts.lvl, { n: 6, t: 7 }, "the older client's merge LOWERS the cloud's 11 to its own 6, and pushes that");
  // a local copy without one (an older blob) drops the cloud's altogether
  const bare = boot({ Mod: OLD });
  delete bare.belts.lvl;   // a local copy an older client wrote: no level of its own (this harness's own sync seeded one)
  bare._mergeProgressFields({ v: 2, belts: { won: {}, lvl: { n: 11, t: 9 } } });
  assert.equal(bare.belts.lvl, undefined, "with none of its own it DROPS the cloud's");
  // a current client that still holds 11 pulls the older client's push and keeps 11; it pushes 11 back
  const cur = boot({ blob: { belts: { won: {}, lvl: { n: 11, t: 9 } } } });
  const next = cur._mergeProgressBlobs(cur._progressBlob(), old._progressBlob());
  assert.deepEqual(next.belts.lvl, { n: 11, t: 9 });
});

test("a player's blob from before this version loads, saves and syncs unchanged apart from the added value", () => {
  const seed = boot();
  prove(seed, "white", "gi", ["u1", "u2"]);
  prove(seed, "blue", "gi", ["u1"]);
  // a reload's own fixpoint (its challenge evidence filled in, as any client's reload fills it), less the one added value:
  // the blob a client before v1.276.0 saves for the same player
  const before = boot({ blob: seed._progressBlob() })._progressBlob();
  delete before.belts.lvl;
  const a = boot({ blob: before });
  const after = a._progressBlob();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === "updatedAt") continue;   // the write-time stamp (`ngProgressCloudKey` leaves it out too)
    if (k === "belts") {
      const { lvl, ...rest } = after.belts;
      assert.deepEqual(rest, before.belts, "belts: every key as it was");
      assert.equal(lvl.n, 7, "and the one added value: blue, two stripes");
      continue;
    }
    assert.deepEqual(after[k], before[k], "unchanged: " + k);
  }
  // and its merge with a cloud of the same blob changes nothing either
  const merged = a._mergeProgressBlobs(after, before);
  assert.deepEqual(merged.belts.lvl, after.belts.lvl);
});

test("the Path's own level: black is 20 whatever its stripes; anything else 5 × belt + stripes", () => {
  assert.deepEqual([ngRatingPathLevel(0, 0), ngRatingPathLevel(1, 2), ngRatingPathLevel(3, 4), ngRatingPathLevel(4, 4), ngRatingPathLevel(5, 0)], [0, 7, 19, 20, -1]);
  // the row draws the Path's black as black with no stripe (table a); the Path's own rule keeps its four
  const a = boot();
  for (const id of NG_BELT_IDS) prove(a, id, "gi", ["u1", "u2"]);
  assert.deepEqual([a.wornBelt().id, a.wornBelt().stripes, a.belts.lvl.n, row(a).belt, row(a).stripes], ["black", 4, 20, "black", "0"]);
});

test("a drawer opened before the game is in waits, and reads once it lands; a failed check does not ask at a grade", async () => {
  const a = boot({ blob: { belts: { won: {}, lvl: { n: 2, t: 3 } } } });
  let r = { status: "no-manifest", final: true, points: null };
  a.rating = () => r; let asked = 0; a.ratingCheck = () => { asked++; return Promise.resolve(r); };
  a.deckShown = true;
  await a._askBeltRow();
  assert.deepEqual([row(a).state, row(a).number, asked], ["wait", "", 0], "the game not in: waiting, nothing asked of the live check");
  r = { status: "ok", final: true, points: 1240, frame: "gi" };
  a._syncBelt("manifest");   // the manifest lands: the belt sync asks once more
  await Promise.resolve();
  assert.deepEqual([row(a).state, row(a).number], ["ok", "1240"], "BELT-M15: read once the game is in");
  // a failed live check is not this: a grade's belt sync asks nothing
  r = { status: "unchecked", reason: "fetch-failed", final: false, points: null };
  const b = boot({ reading: r });
  b.deckShown = true; let bAsked = 0; b.ratingCheck = () => { bAsked++; return Promise.resolve(r); };
  await b._askBeltRow();
  b._syncBelt("grade:test"); b._syncBelt("grade:test");
  assert.equal(bAsked, 1, "one ask at the open, none at a grade");
});

// ── R1 (the independent read of PR #412): the ruleset flip, and one promotion per level across tabs and devices ──
test("a reading taken in the other ruleset is never painted: the row wears the belt held and waits", async () => {
  const a = boot({ reading: ok(1300, "gi") });
  await a._askBeltRow();
  assert.equal(row(a).number, "1300");
  a._giMode = "nogi";   // the ruleset changed and nothing has asked yet
  assert.deepEqual([row(a).state, row(a).number, row(a).belt], ["wait", "", "white"], "BELT-M16: the gi number is not painted in no-gi");
});

test("a ruleset flip with the drawer shown asks again: the new ruleset's number, never the old one's", async () => {
  const a = boot({ frame: "gi" });
  a.rating = () => (a._giMode === "nogi" ? ok(1100, "nogi") : ok(1300, "gi"));
  let asked = 0; a.ratingCheck = () => { asked++; return Promise.resolve(a.rating()); };
  a.deckShown = true;
  await a._askBeltRow();
  assert.equal(row(a).number, "1300");
  a.setGiMode("nogi");
  assert.deepEqual([row(a).state, row(a).number, asked], ["ok", "1100", 0], "BELT-M17: the no-gi number, read at the flip; nothing fetched");
  a.setGiMode("gi");
  assert.equal(row(a).number, "1300", "and back");
});

test("two tabs: a level another tab already saved fires nothing (the stored copy every tab saves to)", async () => {
  let stored = null;
  const host = { store: { read: () => (stored ? { status: "ready", blob: stored } : { status: "empty", blob: null }) } };
  const tab = () => {
    const t = boot({ blob: { belts: { won: {}, lvl: { n: 7, t: 3 } } }, reading: ok(1416.4) });
    Object.assign(t, { _progressHost: host, _progressOwner: { kind: "guest" } });
    t._flushSave = () => { stored = JSON.parse(JSON.stringify(t._progressBlob())); };
    return t;
  };
  const A = tab(), B = tab();   // both loaded the same copy, before either raised it
  await A._askBeltRow();
  assert.deepEqual([stored.belts.lvl.n, beats(A, "level_reached").length], [8, 1], "tab A: raised, written, fired once");
  await B._askBeltRow();
  assert.deepEqual([B.belts.lvl.n, beats(B, "level_reached").length, B.tracked.filter(([e]) => e === "neural_level_reached").length], [8, 0, 0],
    "BELT-M18: tab B raises its own copy and fires nothing");
});

test("an account before its first pull: raised, nothing fires until the pull merged; then only if the cloud did not bring it", async () => {
  const acct = (cloudN) => {
    const a = boot({ blob: { belts: { won: {}, lvl: { n: 7, t: 3 } } }, reading: ok(1416.4) });
    const cloud = { v: 2, belts: { won: {}, lvl: { n: cloudN, t: 1 } } };
    // ONE facade object: the pull checks it is still the same one when its answer lands
    const facade = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: clone(cloud) }) };
    Object.assign(a, { _progressOwner: { kind: "account", id: "A" }, _authUserId: "A", _authDisposed: false, _progressLocalOnly: false,
      _auth: () => facade });
    return a;
  };
  const a = acct(5);
  await a._askBeltRow();
  assert.deepEqual([a.belts.lvl.n, beats(a, "level_reached").length], [8, 0], "BELT-M19: raised before the pull, nothing fired");
  assert.equal(await a._pullAndMerge(), true, "the first pull lands (the real _pullAndMerge, a fake facade)");
  assert.deepEqual([a.belts.lvl.n, beats(a, "level_reached").length, a.tracked.filter(([e]) => e === "neural_level_reached").length], [8, 1, 1],
    "BELT-M21: the cloud held less: it fires once, after the pull");
  await a._pullAndMerge(); await a._askBeltRow();
  assert.equal(beats(a, "level_reached").length, 1, "and never again");
  const b = acct(8);
  await b._askBeltRow();
  await b._pullAndMerge();
  assert.deepEqual([b.belts.lvl.n, beats(b, "level_reached").length], [8, 0], "BELT-M20: the cloud brought it: nothing fires");
  const c = acct(12);
  await c._askBeltRow(); await c._pullAndMerge();
  assert.deepEqual([c.belts.lvl.n, beats(c, "level_reached").length], [12, 0], "the cloud brought more: nothing fires, the higher is held");
});

// ── THE LIVE CHECK AT THE DRAWER: a reopen (the real `ratingCheck`, on this worktree's emitted payload) ──
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../source/quartz/static/neural");
test("a reopen: nothing fetched after a check that landed; one more try after a failed one", async () => {
  const FIX = ratingFixture(DIR), realFetch = globalThis.fetch, asked = [];
  let fail = true;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const m = /flashcards\/(live-\d+)\.json\?live=([0-9a-f]{8})$/.exec(String(url));
    if (fail || !m) return { ok: false, status: 503, json: async () => null };
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(resolve(DIR, "flashcards", m[1] + ".json"), "utf8")) };
  };
  try {
    const a = ratingApp(DIR, "gi", { live: false });
    a.srs = FIX.blob.srs; a.stage = FIX.blob.stage; a.moves = FIX.blob.moves;
    const r1 = await a._askBeltRow();   // the first open, offline
    assert.deepEqual([r1.final, r1.reason, a._beltReading, asked.length], [false, "fetch-failed", null, 2], "offline: no number, quiet");
    fail = false;
    const r2 = await a._askBeltRow();   // the next open: one more try
    assert.deepEqual([r2.status, r2.final, asked.length], ["ok", true, 4], "BELT-M14: the next open tries once more, and lands");
    await a._askBeltRow(); await a._askBeltRow();   // closed and reopened twice
    assert.equal(asked.length, 4, "BELT-M13: nothing fetched again after the check landed");
    assert.equal(a._beltReading.points, r2.points);
  } finally { globalThis.fetch = realFetch; }
});
