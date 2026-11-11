// PROTECT THE STORED ACCOUNTS (v1.255.0, HIDE1B; the owner, 10 Nov: "i'd like to protect the current users, and not
// have them lose progress"). Hidden moves adds ONE field, `moves`, to the saved v2 blob. These tests drive the REAL
// class with the bundle's prelude (the order neural/build/build.mjs concatenates) on a realistic saved account:
//
//   1. OLD BLOB, NEW APP: a blob saved before v1.255.0 (no `moves`) loads with every number unchanged — prep, stage,
//      rec, srs, belts, units, the account menu's "Mastered N · X%", each deck's mastery and its odds bonus
//      (`stateBonus` = mastery + sharpness), the due count and today's Practice count. From v1.256.0 (stage 2, owner
//      U124 a) a `moves` record ADDS odds and moves no flashcard figure; it never takes a point away.
//   3. TWO NEW DEVICES: the app's own merge (`_mergeProgressBlobs`) of two `moves` records gives the same cells in
//      either order of arrival: the later answer wins, a same-day tie goes to the smaller interval.
//   4. NOTHING REWRITTEN: every field the old blob carried is emitted byte-equal, under its own key; the only new key
//      is `moves`.
//
// Item 2 (a NEW blob in an OLD app) cannot run here — CI has only this tree's source. It was traced on v1.253.0's own
// code (origin/dev dc01c3d44) and is written up in the archive entry for v1.255.0.
//
// STAGE 2 (v1.256.0) drives the real class on the REAL wire (source/quartz/static/neural/graph-data.json, as
// tests/_census.mjs does), because what a known move is worth depends on the dealt hands: the ordinals `_moveKey`
// files, the seat's hand in this ruleset, the technique's deck. Claims, each over seeded random accounts in both
// rulesets and the stored-account fixture above:
//   5. NOTHING DROPS, EXACTLY: every deck's `knowledgeProfile().permanent` is at least the flashcard-only figure
//      (`ngKnowledgeMastery(prep)`), IS the app's own `mastery(key)` (`Object.is`: the dice and the card read the same
//      double as the Win %), never exceeds 0.15; and an account with no known move gets the profile v1.255.2 built,
//      byte for byte (v1.255.2's `knowledgeProfile` body is copied below, from origin/dev 6a5bfa27f). `permanent`,
//      never the Win %: the worker's figure moved between boots that were not rigged (STAGE2D: the per-roll move cap).
//   5b. BIT EQUALITY, EXHAUSTIVELY (review STAGE2E): every dealt seat on the wire, both rulesets, k = 0..n of its moves
//      known, prep 0..5, `permanent` is `mastery` and every card's live chance is the worker's explained chance under
//      the provider's own `!==` (game-value-provider.src.js). NO TOLERANCE anywhere in these stage 2 units: the app
//      compares exactly, so they do; the first build's 1e-12 is what let a one-ulp mismatch through.
//   6. A NO TAKES IT BACK; a Yes and its republish; level 1 and 2 in either order; a ruleset switch; a pull.
//   7. PRACTICE KEEPS THE FLASHCARD-ONLY FIGURE: with every Mount Top move known, Practice still offers Mount|Top's
//      cards as new (FLOW's weak spots and the planner's gate both read `_flashMastery`), while the study presenter's
//      descriptor (`_gameplanDecks()`) still equals the profile's headroom, exactly (the presenter allows 1e-12).
// MUTANTS (2026-11-10, each turned the named test red):
//   hydrate files `moves` into `srs`                     → old blob: every number unchanged, nothing rewritten
//   `_gradeMove` also bumps `stage` for the state's deck → old blob: a full moves record moves no number
//   the merge ignores the cloud's `moves`                 → two new devices
//   the emit re-keys `srs` (deck keys lower-cased)        → old blob: nothing rewritten
//   `moves: {}` emitted for every account (review R4)     → old blob: no `moves` key, v1.254.0's keys in order
//   a grade cuts the row to four cells (review R5)         → R4 / R5
// STAGE 2 MUTANTS (2026-11-11, each turned the named test red; table in docs/Changelog-Archive.md, v1.256.0):
//   no 0.15 cap                                → the worth; nothing drops
//   the technique part 0.12                    → the worth
//   any known move fills the seat              → the worth
//   the worker handed the stored prep          → nothing drops (permanent = mastery)
//   `_gradeMove` does not republish            → a No takes it back
//   Practice's descriptor moves-aware          → Practice keeps the flashcard-only figure
//   FLOW's mastery moves-aware                 → Practice keeps the flashcard-only figure
//   the map's level 2 never set                → gold level 2
//   known = ever graded (the No ignored)       → a No takes it back; nothing drops
//   the cache blind to the ruleset             → a ruleset switch
//   the line's total cached once for gi        → a ruleset switch
//   the seat not stood in before landing       → before the first landing
// ONE NON-KILL, a second guard: dropping the record's identity from `_movesIdx`'s cache key changes nothing here,
// because every path that replaces the record (`_hydrateProgressBlob`) also publishes, which moves `_stageVer`.
// NOT a gate here, by construction: dropping a field from `_progressBlob`'s explicit list survives, because the emit
// spreads the loaded blob's own fields first (`_progressExtras`), so an old field rides through either way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  strip(rd("neural/src/flow.src.js")),            // FLOW's weak spots rank Practice's new decks (claim 7)
].join("\n");
const M = new Function("DCLogic", "React", SOURCE + "\nreturn { Component, ngKnowledgeBuildProfile, ngKnowledgeMastery, ngKnowledgeFingerprint, ngKnowledgeExplainMove, ngKnowledgeExplainEscape };")(class DCLogic {}, { createRef: () => ({ current: null }) });

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
// a stand-in for an option card: records the gold attribute `_goldCard` writes
const CARD = () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });
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

test("R4 / R5: a graded account saves `moves`; a grade keeps a later build's tail on the row", () => {
  const a = boot({ v: 2, moves: { "76/top": { "307": [DAY - 1, 3, DAY - 4, 1, 5, 9] } } });
  a.nodes = [{ id: "Positions/Mount", t: "Mount", ty: "positions" }, { id: "Submissions/Kimura/from-Mount", t: "Kimura from Mount", ty: "submissions" }];
  a._ordById = new Map([["Positions/Mount", 76], ["Submissions/Kimura/from-Mount", 307]]);
  a.siteIdOf = (id) => id; a._hmAt = 0; a.currentPos = 0; a.playerRole = "top";
  a._gradeMove({ idx: 1, node: a.nodes[1] }, true, CARD());
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

// ── STAGE 2 (v1.256.0): what a known move is worth, on the real wire ──────────────────────────────────────────────────
const WIRE = rd("source/quartz/static/neural/graph-data.json");
// "Moves known N of M": the pairs dealt over every position seat the ruleset deals, per ruleset (tests/_census.mjs computes both from
// the app's own `_movesKnownLine`, so a content change rewrites them with `npm run census:update`)
const PAIRS_GI = 1350;   // census:movePairs
const PAIRS_NOGI = 1206;   // census:movePairsNogi
function wireBoot(blob, mode = "gi") {
  const a = Object.create(M.Component.prototype);
  Object.assign(a, { settings: {}, _settingsAt: {}, beats: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  for (const k of ["_saveProgress", "_flushSave", "track", "renderTutorial", "setEvent", "setDeckOpen", "_applyLayers", "_gameValueChanged"]) a[k] = () => {};
  a._progressCurrent = () => true; a.get = (_k, d) => d; a.set = () => {};
  a.curriculum = { belts: [], weights: {} }; a._syncBelt = () => {};   // no belt here (belts are stage 4)
  a.ingest(JSON.parse(WIRE));
  a._giMode = mode; a.playerRole = "top";
  a.currentPos = a.nodes.find((n) => n.id === "Positions/Mount").idx;
  a._hydrateProgressBlob(JSON.parse(JSON.stringify(blob)));
  a._progressLoaded = true;
  return a;
}
// v1.255.2's `knowledgeProfile()` (origin/dev 6a5bfa27f), verbatim but for `this` → `a`: the profile an account got
// before stage 2. An account with no known move must get exactly this.
const v1255Profile = (a) => {
  const day = a._checkKnowledgeDay();
  return M.ngKnowledgeBuildProfile({ prep: a.prep, sharp: a._sharp, userMods: a.userMods,
    filmLook: a._filmLook, flowCounts: a.flowCounts(), revision: a._knowledgeRevision || 0,
    contentRevision: a._knowledgeContentRevision || "", day: day,
    evidenceRevision: M.ngKnowledgeFingerprint({ stage: a.stage || {}, rec: a.rec || {}, srs: a.srs || {} }) });
};
// every seat with a hand in this ruleset, as `_moveKey` files it: [site ordinal "/" role, hub index, dealt ordinals]
function seatsOf(a) {
  const out = [], seen = new Set();
  for (const n of a.nodes) {
    const o = n.ty === "positions" ? a._ordById.get(a.siteIdOf(n.id)) : null;
    if (o != null) for (const role of ["top", "bottom"]) {
      if (seen.has(o + "/" + role)) continue; seen.add(o + "/" + role);
      const d = a._dealtOrds(n.idx, role);
      if (d.length) out.push({ st: o + "/" + role, i: a._idIndex.get(a._ordToId.get(o)), role, key: a.posFamily(n.t) + "|" + (role === "bottom" ? "Bottom" : "Top"), dealt: d });
    }
  }
  return out;
}
const techKey = (a, ord) => a.deckKeyFor(a.nodes[a._idIndex.get(a._ordToId.get(+ord))]).key;
const row = (ok) => [DAY + (ok ? 3 : 1), ok ? 3 : 1, DAY - 1, ok ? 1 : 0];
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 8) / (1 << 24);

test("stage 2, nothing drops, exactly: over seeded accounts in both rulesets, `permanent` >= the flashcard figure, = mastery(key), <= 0.15", () => {
  for (const mode of ["gi", "nogi"]) {
    const probe = wireBoot({ v: 2 }, mode), SEATS = seatsOf(probe);
    assert.ok(SEATS.length > 240, mode + ": the sweep found the seats (" + SEATS.length + ")");   // positive coverage
    const fixtures = [{ ...oldBlob(boot({ v: 2 })), moves: MOVES }];
    for (let seed = 1; seed <= 60; seed++) {
      const r = lcg(seed * 7919 + (mode === "gi" ? 0 : 1)), moves = {}, prep = {};
      for (let s = 0, n = 1 + ((r() * 6) | 0); s < n; s++) {
        const seat = SEATS[(r() * SEATS.length) | 0], all = r() < 0.3, cells = (moves[seat.st] = moves[seat.st] || {});
        for (const d of seat.dealt) if (all || r() < 0.4) cells[d] = row(all || r() < 0.6);
        if (r() < 0.3) cells["e" + ((r() * 0xfffffff) | 0).toString(16)] = row(r() < 0.5);   // an escape
        if (r() < 0.2) cells["999999"] = row(true);                                            // an ordinal no hand deals
        if (r() < 0.7) prep[seat.key] = (r() * 9) | 0;
        for (const d of seat.dealt) if (r() < 0.2) prep[techKey(probe, d)] = (r() * 9) | 0;
      }
      fixtures.push({ v: 2, prep, moves });
    }
    let lifted = 0, checked = 0;
    // one booted app per ruleset; each account is hydrated into it, as a pull or another tab's save would be
    const load = (blob) => { probe._hydrateProgressBlob(JSON.parse(JSON.stringify(blob))); return probe; };
    for (const blob of fixtures) {
      const a = load(blob), P = a.knowledgeProfile(), c = a._movesIdx();
      assert.equal(P.status, "ready", "the profile builds: " + JSON.stringify(P.diagnostics));
      const keys = new Set([...Object.keys(a.prep), ...c.tech, ...SEATS.map((s) => s.key)]);
      for (const k of keys) {
        const flash = M.ngKnowledgeMastery(a.prep[k] || 0), perm = P.permanent[k] || 0;
        assert.ok(perm >= flash, mode + " " + k + ": permanent " + perm + " fell below the flashcard figure " + flash);
        assert.ok(Object.is(perm, a.mastery(k)), mode + " " + k + ": the worker reads " + perm + ", the dice " + a.mastery(k));
        assert.ok(perm <= 0.15, k + ": the 0.15 cap");
        if (perm > flash) lifted++;
        checked++;
      }
      // the same account with every Yes turned into a No: v1.255.2's profile, byte for byte
      const nos = JSON.parse(JSON.stringify(blob.moves || {}));
      for (const st in nos) for (const mv in nos[st]) nos[st][mv][3] = 0;
      const b = load({ ...blob, moves: nos });
      assert.equal(b._knowledgePrep(), b.prep, "no known move: the stored prep itself is handed over");
      assert.equal(JSON.stringify(b.knowledgeProfile()), JSON.stringify(v1255Profile(b)), "no known move: v1.255.2's profile");
    }
    assert.ok(lifted > 200 && checked > 5000, mode + ": the moves really lifted decks (" + lifted + " of " + checked + ")");   // non-trivial
  }
  const none = wireBoot(oldBlob(boot({ v: 2 })));
  assert.equal(JSON.stringify(none.knowledgeProfile()), JSON.stringify(v1255Profile(none)), "the stored-account fixture, no `moves`: v1.255.2's profile");
});

test("stage 2, bit equality: every dealt seat, both rulesets, k = 0..n known, prep 0..5: the card's chance IS the worker's", (t) => {
  let states = 0, cards = 0;
  for (const mode of ["gi", "nogi"]) {
    const a = wireBoot({ v: 2 }, mode);
    a.aiSkill = 0.13; a._qMod = 0; a._combo = 0;
    const seen = new Set();
    for (const n of a.nodes) {
      if (n.ty !== "positions" || !a.rsAllowsIdx(n.idx)) continue;
      const o = a._ordById.get(a.siteIdOf(n.id));
      for (const role of ["top", "bottom"]) {
        if (seen.has(o + "/" + role)) continue; seen.add(o + "/" + role);
        a.currentPos = a.canonicalState(n.idx, role); a.playerRole = role;
        const here = a.nodes[a.currentPos], key = a.posFamily(here.t) + "|" + (role === "bottom" ? "Bottom" : "Top");
        const dealt = a.optionsFor(a.currentPos, role);
        if (!dealt.length) continue;
        const ords = dealt.map((d) => String(a._ordById.get(a.siteIdOf(a.nodes[d.idx].id))));
        for (let k = 0; k <= ords.length; k++) for (let p = 0; p <= 5; p++) {
          // the record as a grade leaves it; a publish is what a grade or a pull does (it moves `_stageVer`)
          a.prep = { [key]: p }; a.moves = k ? { [o + "/" + role]: Object.fromEntries(ords.slice(0, k).map((d) => [d, row(true)])) } : {};
          a._stageVer = (a._stageVer || 0) + 1; a._posKey = key;
          const P = a.knowledgeProfile();
          assert.ok(Object.is(P.permanent[key], a.mastery(key)), `${mode} ${here.id} ${role} k ${k}/${ords.length} p ${p}: permanent ${P.permanent[key]} vs mastery ${a.mastery(key)}`);
          assert.ok(P.permanent[key] >= M.ngKnowledgeMastery(p), `${mode} ${here.id} ${role} k ${k} p ${p}: below the flashcard figure`);
          for (const d of dealt) {
            // the provider's own comparison, as game-value-provider.src.js makes it: an entry is certain and is not
            // compared; a transition (or a finish) compares `moveChance` with the explained chance by `!==`
            if (d.action === "enter" || (!d.action && d.node.ty === "submissions") || d.action === "escape") continue;
            const ctx = { ruleset: a._giMode, positionKey: a._posKey || null, noPositionBonus: a._posKey == null,
              techniqueKey: a.deckKeyFor(d.node).key, opponentValue: a.oppVal(here), aiSkill: a.aiSkill, qMod: a._qMod || 0,
              combo: a._combo || 0, arrivalAge: 0 };
            const e = M.ngKnowledgeExplainMove(P, ctx, d.node), live = a.moveChance(d.node);
            assert.equal(e.status, "ready", "the law explains it");
            assert.ok(Number.isFinite(live) && live === e.chance, `${mode} ${here.id} ${role} k ${k}/${ords.length} p ${p}, ${d.node.id}: card ${live} vs worker ${e.chance} (live-knowledge-probability-mismatch)`);
            cards++;
          }
          states++;
        }
      }
    }
  }
  t.diagnostic(`${states} seat states, ${cards} cards compared, both rulesets`);
  assert.ok(states > 15000 && cards > 100000, `positive coverage: ${states} seat states, ${cards} cards compared`);
});

test("stage 2, bit equality on ESCAPES: a defended submission from every partly known seat, its panic deck the seat's own", (t) => {
  // review STAGE2F: when the Defender deck is not resident the panic key falls back to the seat's deck (`_posKey`,
  // `enterDefense`), so an escape's chance carries the seat's partly known figure too. The provider compares
  // `escapeChance` with `ngKnowledgeExplainEscape` by `!==`, as it does a move.
  let states = 0, cards = 0;
  for (const mode of ["gi", "nogi"]) {
    const a = wireBoot({ v: 2 }, mode);
    a.aiSkill = 0.13; a._qMod = 0; a._combo = 0;
    const seen = new Set();
    for (const n of a.nodes) {
      if (n.ty !== "positions" || !a.rsAllowsIdx(n.idx)) continue;
      const o = a._ordById.get(a.siteIdOf(n.id));
      for (const role of ["top", "bottom"]) {
        if (seen.has(o + "/" + role)) continue; seen.add(o + "/" + role);
        const opp = role === "top" ? "bottom" : "top";
        a.currentPos = a.canonicalState(n.idx, role); a.playerRole = role;
        const here = a.nodes[a.currentPos], key = a.posFamily(here.t) + "|" + (role === "bottom" ? "Bottom" : "Top");
        const dealt = a.optionsFor(a.currentPos, role);
        const sub = a.optionsFor(a.canonicalState(n.idx, opp), opp).map((d) => d.node).find((x) => x.ty === "submissions");
        if (!dealt.length || !sub) continue;
        // its defenses arrive in their own chunk, as `loadSubmissionChoices` fetches them
        const S = a.submissionNode(sub);
        if (!S.cal.defenses) { const body = JSON.parse(rd("source/quartz/static/neural/submission-details/" + a.qhash(S.t) + ".json"))[S.t]; S.cal.defenses = body.choices; S._defenseDetails = body.details || []; }
        a.currentPos = a.canonicalState(n.idx, role);
        const escapes = a.submissionDefenses(sub);
        if (!escapes.length) continue;
        const ords = dealt.map((d) => String(a._ordById.get(a.siteIdOf(a.nodes[d.idx].id))));
        for (let k = 0; k <= ords.length; k++) for (let p = 0; p <= 5; p++) {
          a.prep = { [key]: p }; a.moves = k ? { [o + "/" + role]: Object.fromEntries(ords.slice(0, k).map((d) => [d, row(true)])) } : {};
          a._stageVer = (a._stageVer || 0) + 1; a._posKey = key;
          a._defendSub = sub.idx; a._panicKey = key;
          const P = a.knowledgeProfile();
          for (const e of escapes) {
            // the provider's escape context, as game-value-provider.src.js builds it
            const ctx = { ruleset: a._giMode, positionKey: a._posKey || null, noPositionBonus: a._posKey == null,
              techniqueKey: a.deckKeyFor(e.node).key, opponentValue: a.oppVal(here), aiSkill: a.aiSkill, qMod: a._qMod || 0,
              combo: a._combo || 0, arrivalAge: 0, defenderKey: a.defendKeyFor(sub), panicKey: a._panicKey || null,
              submissionValue: a.myVal(sub), destinationValue: a.myVal(a.nodes[e.res] || e.node) };
            const x = M.ngKnowledgeExplainEscape(P, ctx, sub), live = a.escapeChance(e);
            assert.equal(x.status, "ready", "the law explains the escape");
            assert.ok(Number.isFinite(live) && live === x.chance, `${mode} ${here.id} ${role} k ${k}/${ords.length} p ${p}, escape from ${sub.id}: card ${live} vs worker ${x.chance}`);
            cards++;
          }
          states++;
        }
        a._defendSub = null; a._panicKey = null;
      }
    }
  }
  t.diagnostic(`${states} defended seat states, ${cards} escape cards compared, both rulesets`);
  assert.ok(states > 5000 && cards > 10000, `positive coverage: ${states} states, ${cards} escape cards`);
});

test("stage 2, the moves index is keyed on the record: a grade and a pull refresh the share; a flashcard answer re-levels the gold without dealing a hand", () => {
  // review STAGE2F: keyed on `_stageVer`, the index re-dealt every known seat's hand on the frame after every deck
  // landing, move and grade. Keyed on the record (its identity, `_movesRev`) and the ruleset, only the gold's level
  // follows `_stageVer`.
  const a = wireBoot({ v: 2 }), mount = seatsOf(a).find((x) => x.key === "Mount|Top");
  a.currentPos = mount.i; a.playerRole = "top";
  const opts = a.optionsFor(mount.i, "top");
  let deals = 0; const real = a.optionsFor; a.optionsFor = function (...x) { deals++; return real.apply(this, x); };
  assert.equal(a._seatShare("Mount|Top"), 0, "nothing known");
  a._gradeMove(opts[0], true, CARD());                              // the record mutates IN PLACE
  assert.equal(a._seatShare("Mount|Top"), 1 / opts.length, "a grade refreshes the share (the revision moved)");
  for (const o of opts.slice(1)) a._gradeMove(o, true, CARD());
  assert.equal(a._movesGold().get(a.nodes.find((x) => x.id === "Positions/Mount" && x.role !== "bottom").idx), 1, "every move known: the seat's thin gold");
  // a flashcard answer: the seat's deck learned and published, as a grade publishes. The level follows; no hand is dealt
  a.flashcards = { decks: { "Mount|Top": { n: 1, cards: [{ q: "Mount q0", a: "x" }] } }, manifest: true };
  a.stage = { "Mount|Top": { [a.qhash("Mount q0")]: 3 } };
  a._publishKnowledge("test:flashcard");
  deals = 0;
  assert.equal(a._movesGold().get(a.nodes.find((x) => x.id === "Positions/Mount" && x.role !== "bottom").idx), 2, "the level moves to 2");
  assert.equal(deals, 0, "...without dealing a hand");
  a._publishKnowledge("test:deck-landed");                             // a deck landing, a move played: `_stageVer` moves
  deals = 0; a._movesGold(); a._seatShare("Mount|Top"); a.mastery("Mount|Top");
  assert.equal(deals, 0, "a stage bump alone re-deals nothing");
  // a pull replaces the record (its identity), from another device's: one move known there
  a._hydrateProgressBlob(a._mergeProgressBlobs({ v: 2 }, { v: 2, moves: { [mount.st]: { [mount.dealt[0]]: row(true) } } }));
  assert.equal(a._seatShare("Mount|Top"), 1 / mount.dealt.length, "a pull refreshes the share");
});

test("stage 2, the Moves known line prints nothing it cannot count: before the graph is in, or when a hand fails to deal", () => {
  const a = Object.create(M.Component.prototype);
  a.moves = {}; a.nodes = undefined;
  assert.equal(a._movesKnownLine(), null, "the menu can open before the graph: no line, no throw");
  const b = wireBoot({ v: 2 });
  assert.deepEqual(b._movesKnownLine(), { known: 0, total: PAIRS_GI });
  const c = wireBoot({ v: 2 }), real = c.optionsFor;
  let n = 0; c.optionsFor = function (...x) { if (++n === 40) throw new Error("a hand that cannot be dealt"); return real.apply(this, x); };
  assert.equal(c._movesKnownLine(), null, "a hand failed to deal: no line (never a false 'Moves known 0 of ...')");
  assert.ok(c.beats.some((x) => x.beat === "moves_hand_failed"), "...and the failure is named once");
  c.optionsFor = real;
  assert.deepEqual(c._movesKnownLine(), { known: 0, total: PAIRS_GI }, "the next open counts it whole: the partial count was never cached");
});

test("stage 2, M counted independently: the Python dealer (scripts/_mdp_mechanics.py) deals the same pairs over the same seats", () => {
  // review STAGE2F: the census computes M through the app's own `_movesKnownLine`, so alone it catches a stale count,
  // not a wrong definition. The Python twin of the dealer (the MDP metadata's `Projection.options`) is a second
  // implementation; over its allowed position seats, deduped by site and role, it must agree with the app in both rulesets.
  const py = [
    "import json, sys", "sys.path.insert(0, 'scripts')", "import _mdp_mechanics as mm",
    "wire = json.load(open('source/quartz/static/neural/graph-data.json'))", "out = {}",
    "for rs in ('gi', 'nogi'):",
    "    P = mm.Projection(wire, {}, rs); seen = set(); pairs = seats = 0",
    "    for n in P.by_id.values():",
    "        if n.get('ty') != 'positions' or not n.get('allowed'): continue",
    "        for role in ('top', 'bottom'):",
    "            if (n['posId'], role) in seen: continue",
    "            seen.add((n['posId'], role)); o = P.options(n['id'], role)",
    "            if o: seats += 1; pairs += len(o)",
    "    out[rs] = {'pairs': pairs, 'seats': seats}",
    "print(json.dumps(out))"].join("\n");
  const r = spawnSync("python3", ["-c", py], { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" });
  assert.equal(r.status, 0, "the Python dealer ran: " + r.stderr);
  const got = JSON.parse(r.stdout);
  for (const mode of ["gi", "nogi"]) {
    const a = wireBoot({ v: 2 }, mode);
    assert.equal(got[mode].pairs, a._movesKnownLine().total, mode + ": the two dealers count the same pairs");
    assert.equal(got[mode].seats, seatsOf(a).filter((x) => a.rsAllowsIdx(x.i)).length, mode + ": over the same seats");
  }
  assert.deepEqual([got.gi.pairs, got.nogi.pairs], [PAIRS_GI, PAIRS_NOGI], "and the census literals");
});

test("stage 2, the worth: a known pair +0.15 on its deck, a seat 0.15 x the share known, one cap, no flashcard figure moves", () => {
  const plain = wireBoot(oldBlob(boot({ v: 2 }))), a0 = numbers(plain);
  const mount = seatsOf(plain).find((s) => s.key === "Mount|Top"), half = mount.dealt.slice(0, mount.dealt.length >> 1);
  assert.ok(half.length >= 4, "Mount Top deals a real hand: " + mount.dealt.length);
  const a = wireBoot({ ...oldBlob(boot({ v: 2 })), moves: { [mount.st]: Object.fromEntries(half.map((d) => [d, row(true)])) } });
  // the technique part: a pair known is the full 0.15, whatever its prep (Armbar from Mount holds prep 1)
  for (const d of half) assert.equal(a.mastery(techKey(a, d)), 0.15, techKey(a, d) + ": +0.15");
  // the share: half the hand known is 0.075 on top of the deck's own 0.09 (prep 3): 0.165, capped at 0.15
  const share = half.length / mount.dealt.length;
  assert.equal(a._seatShare("Mount|Top"), share);
  assert.equal(a.mastery("Mount|Top"), Math.min(0.15, 0.09 + 0.15 * share), "prep 3 + the seat's share, under the cap");
  assert.equal(a.mastery("Mount|Top"), 0.15, "capped: the +30 ceiling (seat + move) stands");
  const third = wireBoot({ moves: { [mount.st]: Object.fromEntries(mount.dealt.slice(0, 3).map((d) => [d, row(true)])) }, v: 2 });
  assert.ok(Object.is(third.mastery("Mount|Top"), M.ngKnowledgeMastery(5 * (3 / mount.dealt.length))), "no flashcards: the law at 5 x the share known (0.15 x the share)");
  // nothing the flashcards own moves: Mastered, deck mastery, due, today's Practice count
  const n = numbers(a);
  for (const f of ["menu", "due", "today", "prep", "stage", "rec", "srs"]) assert.deepEqual(n[f], a0[f], f + " is the flashcards' and does not move");
  for (const k of Object.keys(DECKS)) { assert.equal(n.decks[k].deckMastery, a0.decks[k].deckMastery); assert.ok(n.decks[k].bonus >= a0.decks[k].bonus, k + ": the odds bonus only rises"); }
  // the account line counts the Yeses dealt in this ruleset
  assert.deepEqual(a._movesKnownLine(), { known: half.length, total: PAIRS_GI });
});

test("stage 2, a No takes it back; a grade republishes; a pull brings a Yes in without a reload", () => {
  const a = wireBoot({ v: 2 }), mount = seatsOf(a).find((s) => s.key === "Mount|Top");
  const opt = a.optionsFor(mount.i, "top")[0], key = a.deckKeyFor(opt.node).key, card = CARD();
  const rev0 = a._knowledgeRevision || 0;
  a._gradeMove(opt, true, card);
  assert.equal(a.mastery(key), 0.15, "a Yes: +0.15 on " + key);
  assert.ok(a._knowledgeRevision > rev0, "a grade republishes the knowledge (the worker re-solves)");
  assert.equal(a.knowledgeProfile().permanent[key], 0.15, "…and the profile carries it");
  assert.equal(card.attrs["data-mastered"], "", "the card's thin gold");
  assert.equal(a._movesGold().get(opt.node.idx), 1, "the map's thin gold");
  assert.equal(a._movesKnownLine().known, 1);
  a._gradeMove(opt, false, card);
  assert.equal(a.mastery(key), 0, "a No: the move's +0.15 is gone until the next Yes");
  assert.equal(a.knowledgeProfile().permanent[key] || 0, 0, "…in the profile too");
  assert.ok(!("data-mastered" in card.attrs) && !a._movesGold().has(opt.node.idx), "…and its gold");
  assert.equal(a._movesKnownLine().known, 0);
  // a pull: the cloud holds a Yes from another device; the merge and the hydrate are the app's own (`_pullAndMerge`)
  const cloud = { v: 2, moves: { [mount.st]: { [mount.dealt[1]]: [DAY + 3, 3, DAY, 1] } } };
  const before = a.mastery(techKey(a, mount.dealt[1]));
  a._hydrateProgressBlob(a._mergeProgressBlobs(a._progressBlob(), cloud));
  assert.equal(before, 0); assert.equal(a.mastery(techKey(a, mount.dealt[1])), 0.15, "the pulled Yes counts at once");
  assert.equal(a.knowledgeProfile().permanent[techKey(a, mount.dealt[1])], 0.15, "…in the worker's profile");
});

test("stage 2, gold level 2 = known and its flashcards learned, in either order; a ruleset switch recomputes share, gold and line", () => {
  const a = wireBoot({ v: 2 }), mount = seatsOf(a).find((s) => s.key === "Mount|Top");
  const opt = a.optionsFor(mount.i, "top")[0], key = a.deckKeyFor(opt.node).key, card = CARD();
  const learn = (k) => { a.flashcards.decks[k] = { n: 2, cards: [{ q: k + " q0", a: "x" }, { q: k + " q1", a: "y" }] }; a.stage[k] = { [a.qhash(k + " q0")]: 3, [a.qhash(k + " q1")]: 3 }; a._publishKnowledge("test"); };
  a.flashcards = { decks: {}, manifest: true };
  a._gradeMove(opt, true, card);
  assert.equal(a._movesGold().get(opt.node.idx), 1); assert.equal(card.attrs["data-mastered"], "");
  learn(key);                                                     // the deck's last detail card learned, no reload
  assert.equal(a.deckMastery(key), 1);
  assert.equal(a._movesGold().get(opt.node.idx), 2, "the map thickens");
  a._paintHandGold.call({ _optionCards: [{ card, opt }], _goldCard: a._goldCard.bind(a) });
  assert.equal(card.attrs["data-mastered"], "2", "the card thickens");
  // the reverse order: flashcards first, then the Yes
  const opt2 = a.optionsFor(mount.i, "top")[1], key2 = a.deckKeyFor(opt2.node).key, card2 = CARD();
  learn(key2);
  assert.ok(!a._movesGold().has(opt2.node.idx), "learned flashcards alone draw no moves gold");
  a._gradeMove(opt2, true, card2);
  assert.equal(a._movesGold().get(opt2.node.idx), 2); assert.equal(card2.attrs["data-mastered"], "2");
  // an ESCAPE stays thin (review STAGE2E): its `deckKeyFor(node)` is the submission's attacking half, not its own deck.
  // Control: the same submission dealt as a move of its own, known, does thicken.
  const sub = a.nodes.find((x) => x.id === "Submissions/Kimura/from-Mount" && x.role !== "defender"), skey = a.deckKeyFor(sub).key;
  learn(skey);
  const esc = { action: "escape", label: "Bridge and roll out of the Kimura", node: sub }, own = { node: sub, idx: sub.idx };
  for (const o of [esc, own]) { const [st, mv] = a._moveKey(o); (a.moves[st] = a.moves[st] || {})[mv] = row(true); }
  a._publishKnowledge("test");
  const escCard = CARD(), ownCard = CARD();
  a._goldCard(escCard, esc); a._goldCard(ownCard, own);
  assert.deepEqual([escCard.attrs["data-mastered"], ownCard.attrs["data-mastered"]], ["", "2"], "a known escape stays thin; the known move on the same learned deck is double");
  // a ruleset switch: a seat whose gi hand has moves no-gi does not deal. Know exactly its no-gi hand.
  const gi = seatsOf(a), nogi = seatsOf(wireBoot({ v: 2 }, "nogi"));
  const seat = nogi.find((s) => { const g = gi.find((x) => x.st === s.st); return g && g.dealt.length > s.dealt.length && s.dealt.every((d) => g.dealt.includes(d)); });
  assert.ok(seat, "a seat whose no-gi hand is a strict subset of its gi hand");
  const b = wireBoot({ v: 2, moves: { [seat.st]: Object.fromEntries(seat.dealt.map((d) => [d, row(true)])) } }, "gi");
  const share = gi.find((x) => x.st === seat.st);
  assert.equal(b._seatShare(seat.key), seat.dealt.length / share.dealt.length, "gi: part of the seat");
  // the seat's own orb: the pair member on that side (a bottom seat's gold is on the lower orb, not the hub)
  const orb = b.nodes.find((n) => n.ty === "positions" && b._ordById.get(b.siteIdOf(n.id)) === +seat.st.split("/")[0] && (n.role === "bottom") === (seat.role === "bottom")).idx;
  assert.ok(!b._movesGold().has(orb), "gi: no seat gold");
  assert.deepEqual(b._movesKnownLine(), { known: seat.dealt.length, total: PAIRS_GI });
  b._giMode = "nogi";
  assert.equal(b._seatShare(seat.key), 1, "no-gi: the whole seat");
  assert.equal(b._movesGold().get(orb), 1, "no-gi: seat gold");
  assert.deepEqual(b._movesKnownLine(), { known: seat.dealt.length, total: PAIRS_NOGI });
  // the same switch through the app's own setter (review STAGE2F): it rebuilds the ruleset mask, which every reader takes
  const c = wireBoot({ v: 2, moves: { [seat.st]: Object.fromEntries(seat.dealt.map((d) => [d, row(true)])) } }, "gi");
  c.explorerListRef = { current: null };
  assert.equal(c._movesGold().has(orb), false, "gi, before the setter: no seat gold");
  c.setGiMode("nogi");
  assert.deepEqual([c._seatShare(seat.key), c._movesGold().get(orb), c._movesKnownLine().total], [1, 1, PAIRS_NOGI], "setGiMode(\"nogi\"): share, gold and line follow");
  c.setGiMode("gi");
  assert.deepEqual([c._seatShare(seat.key), c._movesGold().has(orb), c._movesKnownLine().total], [seat.dealt.length / share.dealt.length, false, PAIRS_GI], "...and back");
});

test("stage 2, before the first landing: a seat's share is dealt with no position stood on, and says nothing failed", () => {
  // the map draws the gold from its first frame, and `optionsFor` orders a hand by the opponent where the roll stands:
  // before any landing nothing stands anywhere (`_dealtOrds` stands the seat in for its one call)
  const probe = wireBoot({ v: 2 }), mount = seatsOf(probe).find((s) => s.key === "Mount|Top");
  const a = wireBoot({ v: 2, moves: { [mount.st]: Object.fromEntries(mount.dealt.map((d) => [d, row(true)])) } });
  a.currentPos = undefined; a._movesCache = null; a.beats = [];
  assert.equal(a._seatShare("Mount|Top"), 1, "the whole seat known, with no position stood on");
  assert.equal(a._movesGold().get(mount.i), 1, "...so its orb is gold on the first frame");
  assert.equal(a.currentPos, undefined, "...and nothing was left standing");
  assert.deepEqual(a.beats.filter((b) => b.beat === "moves_hand_failed"), [], "no hand failed to deal");
});

test("stage 2, Practice with a study comparison in hand: a deck the moves fill keeps its weak-spots place, nothing lost", async () => {
  // dev ranks a known pair's deck when a comparison is in hand (its game headroom is the flashcards'); this PR fills its
  // game odds, so the presenter withholds it (`componentHeadroom.permanent` 0: gameplan-study-presenter.src.js `member`)
  // and only the other decks come back ranked. The planner then gives it its weak-spots place after the ranked decks.
  const G = await import("../neural/src/gameplan.src.js");
  const setup = (moves) => {
    const a = wireBoot({ v: 2, moves });
    a._gameplanRuntime = G; a._gameStudyState = { phase: "ready" };
    a.flashcards = { decks: {}, manifest: true };
    for (const k of ["Mount|Top", "Side Control|Top"]) a.flashcards.decks[k] = { n: 4, cards: [0, 1, 2, 3].map((i) => ({ q: k + " q" + i, a: "x" })) };
    return a;
  };
  const compare = (a, keys) => { a._gameplanProvider = { kind: "learning-opportunity", stamp: a._gameplanStamp(), status: "ready", assumptions: ["a comparison"],
    rows: keys.map((key, i) => ({ key, status: "ready", score: 2 - i, exposure: 0.5, headroom: 0.15, role: key.split("|")[1], reason: "Practising this could win you more games." })) }; };
  const dev = setup({}), mount = seatsOf(dev).find((x) => x.key === "Mount|Top");
  compare(dev, ["Side Control|Top", "Mount|Top"]);                 // dev's view of this account: both decks ranked
  const a = setup({ [mount.st]: Object.fromEntries(mount.dealt.map((d) => [d, row(true)])) });
  assert.equal(a.mastery("Mount|Top"), 0.15, "every Mount Top move known: its game odds are full");
  compare(a, ["Side Control|Top"]);                                // this PR: the comparison cannot rank Mount|Top
  const p0 = dev.planSummary(), p1 = a.planSummary(), num = (n) => String(n);
  assert.deepEqual(p0.fresh.map((r) => r.key), ["Side Control|Top", "Mount|Top"], "dev: both offered, in the comparison's order");
  assert.deepEqual(p1.fresh.map((r) => r.key), ["Side Control|Top", "Mount|Top"], "this PR: both still offered, Mount|Top after the ranked deck");
  assert.equal(p1.fresh[1].source, "weak-spots", "...in its weak-spots place, never passed off as a comparison result");
  assert.deepEqual([dev._gameStudyStatText(p0, num), a._gameStudyStatText(p1, num)], ["2 new", "2 new"], "the Practice line reads the same");
  assert.deepEqual([p0.newCards, p1.newCards], [8, 8], "the same new cards");
  assert.deepEqual([p0.status, p1.status], ["ready", "ready"], "the comparison's status does not turn \"partial\" (review STAGE2F)");
  assert.deepEqual([p0.missing, p1.missing], [[], []], "a deck the moves fill is not missing a comparison: it has nothing to rank");
});

test("stage 2, Practice keeps the flashcard-only figure: every Mount Top move known, Mount|Top's cards are still offered as new", async () => {
  const G = await import("../neural/src/gameplan.src.js");
  const plan = (moves) => {
    const a = wireBoot({ v: 2, moves });
    a._gameplanRuntime = G;
    a.flashcards = { decks: {}, manifest: true };
    for (const k of ["Mount|Top", "Side Control|Top"]) a.flashcards.decks[k] = { n: 4, cards: [0, 1, 2, 3].map((i) => ({ q: k + " q" + i, a: "x" })) };
    return a;
  };
  const probe = plan({}), mount = seatsOf(probe).find((s) => s.key === "Mount|Top");
  const a = plan({ [mount.st]: Object.fromEntries(mount.dealt.map((d) => [d, row(true)])) });
  assert.equal(a.mastery("Mount|Top"), 0.15, "the seat is fully known: its odds part is full");
  assert.equal(a._gameplanDecks(true)["Mount|Top"].headroom, 0.15, "Practice's headroom is the flashcards' own");
  const fresh = a.planSummary().fresh.map((r) => r.key);
  assert.ok(fresh.includes("Mount|Top"), "Practice still offers Mount|Top as new: " + JSON.stringify(fresh));
  assert.ok(probe.planSummary().fresh.some((r) => r.key === "Mount|Top"), "control: offered with nothing known too");
  // the study presenter's descriptor stays the profile's: 0.15 - permanent, exactly (the presenter itself allows 1e-12)
  const P = a.knowledgeProfile(), D = a._gameplanDecks();
  for (const k of Object.keys(D)) assert.ok(Object.is(D[k].headroom, Math.max(0, 0.15 - (P.permanent[k] || 0))), k + ": the presenter's descriptor");
});
