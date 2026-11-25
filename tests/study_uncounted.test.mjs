// THE OPPONENT'S "OFF" IS A STUDY (OFF1, v1.302.0; the owner's U218 b, 25 Nov 2026: "Two choices: Normal · Off (new)").
// Three claims a unit can hold over the whole corpus and the whole challenge catalogue, with the app's own class:
//   1. every event a challenge, a patch or a coin reads is CLASSIFIED: either a roll beat a study does not count
//      (NG_STUDY_UNCOUNTED, app.src.jsx) or a beat that counts in a study as anywhere (STUDY_COUNTED, below). A new challenge
//      on an event in neither list fails here by name, so nobody adds a roll reward that a study quietly earns;
//   2. `fx` keeps exactly the uncounted beats from the challenge engine while a study runs, and nothing else; outside a
//      study every beat reaches it, as on dev;
//   3. a study's move lands at ITS success destination with no draw at all (`_studyLand`): over every technique table on the
//      wire (canonical and per-listing), the row it plays is the first success row that is not a finish (the row
//      `_tableLanding` names), else its finish, and `rng` is never called.
// Each sweep counts what it looked at and fails on zero (CLAUDE.md §6: "found nothing" and "never looked" must differ).
// MUTANTS (OFF1, each alone on a clean tree, this file red at the named test, every other test green): "commit" dropped from
// NG_STUDY_UNCOUNTED -> test 1; the `fx` guard reading `!this._studyRoll` -> test 2; `_studyLand` taking the last success row
// -> both test 3s. Test 2 alone does not see a beat dropped from both lists (it walks their union): test 1 is that guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const knowledge = read("neural/src/knowledge-profile.src.js");
const { Component, NG_STUDY_UNCOUNTED } = new Function("DCLogic", "React", knowledge.replace(/^export /gm, "") + "\n" + read("neural/src/app.src.jsx") +
  "\nreturn { Component, NG_STUDY_UNCOUNTED };")(class {}, { createRef: () => ({ current: null }) });
const defs = new Function(read("neural/src/challenge-definitions.src.js").replace(/^export /gm, "") +
  "\nreturn { NG_ALL_CHALLENGES, NG_BADGE_DEFINITIONS, NG_MAT_COINS };")();
const raw = JSON.parse(read("source/quartz/static/neural/graph-data.json"));

// The beats a study counts, each a thing a study does as much as a roll: reading the hand, the question and its answer and
// refund, a video, the flashcards (opening and resuming), a recall, a roam, the Challenges tab, a lesson, a checkpoint, a
// belt reached. `belt_test_won` is here because a belt test is never a study (it plays the opponent whatever the setting).
const STUDY_COUNTED = new Set(["options_dealt", "sheet_opened", "land_q_shown", "land_q_answered", "timer_refund", "short_watched",
  "pane_paused", "pane_resumed", "recall_proven", "roll_staged", "challenges_opened", "path_opened", "lesson_done",
  "checkpoint_passed", "belt_test_won", "belt_reached"]);

test("OFF1: every event a challenge, a patch or a coin reads is classified as a study counts it or not", () => {
  const events = new Map();
  for (const d of [...defs.NG_ALL_CHALLENGES, ...defs.NG_BADGE_DEFINITIONS, ...defs.NG_MAT_COINS])
    for (const e of [d.event, ...(d.aliases || [])].filter(Boolean)) events.set(e, (events.get(e) || []).concat(d.id));
  assert.ok(events.size > 15, `premise: the catalogue's events were read (${events.size})`);
  const neither = [...events.keys()].filter((e) => !NG_STUDY_UNCOUNTED.has(e) && !STUDY_COUNTED.has(e)).map((e) => `${e} (${events.get(e).join(", ")})`);
  assert.deepEqual(neither, [], "an event in neither list: decide whether a study counts it");
  const both = [...NG_STUDY_UNCOUNTED].filter((e) => STUDY_COUNTED.has(e));
  assert.deepEqual(both, [], "an event in both lists");
  // the roll beats the owner's point 4 names are all uncounted (the study's own list: roll end, escape, combo, commit, defend
  // start, impact, sweep landing)
  for (const e of ["roll_end", "escape", "combo", "commit", "defend_start", "impact_success", "sweep_land"]) assert.ok(NG_STUDY_UNCOUNTED.has(e), e + " is uncounted");
});

test("OFF1: in a study `fx` keeps exactly the uncounted beats from the challenge engine; outside one, every beat reaches it", () => {
  const a = Object.create(Component.prototype), seen = [];
  Object.assign(a, { beats: [], now: 0, noteChallenges: (beat) => seen.push(beat) });
  const all = [...NG_STUDY_UNCOUNTED, ...STUDY_COUNTED];
  for (const study of [true, false]) {
    seen.length = 0; a._studyRoll = study;
    for (const b of all) a.fx(b, {});
    const want = study ? [...STUDY_COUNTED] : all;
    assert.deepEqual(seen, want, study ? "a study: only the counted beats reach the engine" : "a roll: every beat reaches it");
    assert.equal(a.beats.length, all.length, "every beat is still logged");
    a.beats = [];
  }
});

for (const frame of ["gi", "nogi"]) {
  test(`OFF1 (${frame}): a study's move lands at its own success destination, with no draw, over every table on the wire`, () => {
    const a = Object.create(Component.prototype);
    Object.assign(a, { settings: {}, beats: [], get: (k, v) => v, set() {}, track() {}, fx() {}, flare() {}, _saveProgress() {},
      playerRole: "top", currentPos: 0, prep: {}, _sharp: {}, _giMode: frame, aiSkill: 0, _qMod: 0, _combo: 0, flashcards: { decks: {} } });
    a.ingest(structuredClone(raw));
    a.rng = (tag) => { throw new Error("a study drew " + tag); };
    let played = null; a.enterSuccessCal = (opt, out) => { played = out; }; a.enterSuccess = () => { played = "legacy"; };
    let canon = 0, listing = 0, finishes = 0, legacy = 0;
    const wrong = [];
    for (const n of a.nodes) {
      if (n.ty === "positions" || n.role === "defender") continue;
      const tables = [[n, null]];
      for (const here of Object.keys((n.cal && n.cal.at) || {})) tables.push([a._at(n, here), here]);
      for (const [node, here] of tables) {
        played = null;
        a._studyLand({ idx: n.idx, node });
        const rows = ((node.cal && node.cal.outcomes) || []).filter((o) => o.result === "success");
        const want = rows.find((o) => o.to !== "game-over") || rows[0] || null;
        if (!want) { legacy++; if (played !== "legacy") wrong.push(n.id + ": no table, so the legacy landing"); continue; }
        if (played !== want) wrong.push(`${n.id}${here ? " at " + here : ""}: played ${played && played.to}, its own success is ${want.to}`);
        if (want.to === "game-over") finishes++;
        if (here) {
          listing++;
          const r = a.resolveOutcomeTo(want.to);
          const dest = r.idx >= 0 ? a.canonicalState(r.idx, r.role || "top") : null;
          if (dest != null && dest !== a._tableLanding(node, "top", n.idx, -1)) wrong.push(`${n.id} at ${here}: not the row the card names`);
        } else canon++;
      }
    }
    assert.ok(canon > 1000, `premise: the canonical tables (${canon})`);
    assert.ok(listing > 50, `premise: the per-listing tables (${listing})`);
    assert.ok(finishes > 200, `premise: the finishes (${finishes})`);
    assert.deepEqual(wrong, [], "every table lands at its own success destination");
    assert.ok(legacy >= 0);
  });
}
