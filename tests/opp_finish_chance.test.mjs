// O1 (v1.300.2; the owner's ruling U209 a, 24 Nov 2026: "Every time in those spots"). Where the opponent's options at the
// player's seat are finishes ONLY, the opponent goes for a finish every time (`_oppFinishChance` 1, it was 0.9: the other
// 10% played a finish through the positional branch, which reads a drawn tap as a stay). Swept here with the app's OWN walk
// (`_oppOptions`, opponentDefend's split) over every seat the player can stand on, both sides, both rulesets:
//   1. the changed branch (finishes only) is reachable at exactly the seats listed below, and nowhere else;
//   2. there the chance is 1 (dev: 0.9); at every other seat it is byte for byte dev's (`Object.is` against dev's formula,
//      written out below as it stood at v1.300.1).
// A belt test cannot add a seat: it filters finishes to the belt's pool and keeps every positional counter when none is in
// the pool, so its split is finishes-only only where the full split already is. Each sweep counts what it looked at and
// fails on zero (CLAUDE.md §6: never let "found nothing" and "never looked" read the same).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const knowledge = read("neural/src/knowledge-profile.src.js");
const Component = new Function("DCLogic", "React", knowledge.replace(/^export /gm, "") + "\n" + read("neural/src/app.src.jsx") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const raw = JSON.parse(read("source/quartz/static/neural/graph-data.json"));

// THE SCOPE (the data's own, recomputed by this test): seat ids with the player's side, per ruleset
const FINISHES_ONLY = {
  gi: ["Positions/Twister-Control/Bottom"],
  nogi: ["Positions/Twister-Control/Bottom", "Positions/Ashi-Garami/Backside-50-50/Bottom"],
};
// dev's chance as it stood at v1.300.1 (opponentDefend), the reference every other seat must equal
const devChance = (a, subs, trans) => {
  const oppAdv = a.oppVal(a.nodes[a.currentPos]);
  let p = subs.length ? Math.max(0.18, Math.min(0.85, 0.34 + oppAdv * 0.55)) : 0;
  if (!trans.length && subs.length) p = 0.9;
  return p;
};

function appFor(frame) {
  const a = Object.create(Component.prototype);
  Object.assign(a, { settings: {}, beats: [], get: (k, v) => v, set() {}, track() {}, fx() {}, _saveProgress() {}, playerRole: "top", currentPos: 0,
    prep: {}, _sharp: {}, _giMode: frame, aiSkill: 0.07, _qMod: 0, _combo: 0, flashcards: { decks: {} } });
  a.ingest(structuredClone(raw));
  return a;
}

for (const frame of ["gi", "nogi"]) {
  test(`O1 (${frame}): the opponent's finishes-only seats are exactly the listed ones; there the chance is 1, everywhere else dev's`, () => {
    const a = appFor(frame), rsOk = a._rulesetMask();
    const seats = a.nodes.filter((n) => n.ty === "positions" && (n.role === "top" || n.role === "bottom") && rsOk[n.idx]);
    const only = [], diff = [];
    let swept = 0, withFinish = 0;
    for (const s of seats) {
      a.playerRole = s.role; a.currentPos = a.canonicalState(s.idx, s.role);
      if (a.submissionNode(a.nodes[a.currentPos])) continue;   // a submission state: opponentDefend's escape branch, not this one
      swept++;
      const { subs, trans } = a._oppOptions();
      if (subs.length) withFinish++;
      const p = a._oppFinishChance(subs, trans), dev = devChance(a, subs, trans);
      if (!trans.length && subs.length) { only.push(a.nodes[a.currentPos].id); assert.equal(p, 1, s.id + ": a finish every time"); assert.equal(dev, 0.9, "premise: dev's 90%"); }
      else if (!Object.is(p, dev)) diff.push(`${s.id}: ${p} against dev's ${dev}`);
    }
    assert.ok(swept > 200, `premise: every seat swept (${swept})`);
    assert.ok(withFinish > 50, `premise: seats where the opponent has a finish (${withFinish})`);
    assert.deepEqual(only.sort(), FINISHES_ONLY[frame].slice().sort(), "the finishes-only seats are exactly the listed ones");
    assert.deepEqual(diff, [], "every other seat: the chance is dev's, byte for byte");
  });
}
