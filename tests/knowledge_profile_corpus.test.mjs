// Full AVAILABLE wire coverage of the extracted helpers, not a full-roll/MDP
// transition or browser claim. Prior code is captured verbatim with source hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as K from "../neural/src/knowledge-profile.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const source = read("neural/src/app.src.jsx");
const C = new Function("DCLogic", "React", knowledgeSource + "\n" + source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const baseline = JSON.parse(read("tests/artifacts/knowledge_profile_prior.json"));
const prior = new Function(baseline.declarations.NG_SRS_IVLS + "\nreturn {" + Object.values(baseline.methods).join(",\n") + "};")();
const wireText = read("source/quartz/static/neural/graph-data.json");
function boot() {
  const app = Object.create(C.prototype);
  Object.assign(app, { settings: {}, beats: [], track() {}, _saveProgress() {},
    get: (_k, d) => d, set() {}, renderTabSubtitles() {} });
  app.ingest(JSON.parse(wireText));
  return app;
}

test("all wire technique role/frame helpers and loaded escape destinations equal captured prior", async () => {
  const a = boot(), b = Object.create(C.prototype);
  Object.assign(b, a, prior);
  const counts = { attacks: 0, escapes: 0, outcomeDraws: 0, gi: 0, nogi: 0, top: 0, bottom: 0, attacker: 0, defender: 0 };
  const techs = a.nodes.filter(n => ["submissions", "transitions"].includes(n.ty));
  assert.ok(techs.length > 2000, `nontrivial role-technique coverage: ${techs.length}`);
  const scenarios = [
    { prep: 0, sharp: 0, aiSkill: 0, qMod: 0, combo: 0, film: 0 },
    { prep: 2, sharp: .1, aiSkill: .13, qMod: -.08, combo: 3, film: 1 },
    { prep: 20, sharp: .075, aiSkill: -.1, qMod: -.04, combo: 5, film: 1 },
    { prep: -2, sharp: -.025, aiSkill: .4, qMod: -1, combo: -3, film: 0 },
    { prep: 3, sharp: .049, aiSkill: 2, qMod: -5, combo: 50, film: 1, pct: 101 },
    { prep: 0, sharp: 0, aiSkill: -2, qMod: 5, combo: 2, film: 0, pct: -1 },
  ];
  for (const frame of ["gi", "nogi"]) {
    a._giMode = b._giMode = frame;
    for (const act of techs) {
      if (!a.rsAllows(act)) continue;
      const origin = a.techniqueOrigin(act);
      assert.ok(origin.idx >= 0, `missing origin ${act.t}`);
      a.currentPos = b.currentPos = origin.idx; a.playerRole = b.playerRole = origin.role;
      const pk = a.deckKeyFor(a.nodes[origin.idx]).key, tk = a.deckKeyFor(act).key;
      a._posKey = b._posKey = pk;
      counts[frame]++; counts[origin.role]++; counts[act.role]++;
      for (const s of scenarios) {
        const input = { prep: { [pk]: s.prep, [tk]: s.prep + 1 }, sharp: { [pk]: s.sharp, [tk]: s.sharp },
          userMods: s.pct == null ? [] : [{ name: act.t, on: false, pct: 50 }, { name: act.t, on: true, pct: s.pct }],
          filmLook: { [act.t]: s.film } };
        const profile = K.ngKnowledgeBuildProfile(input);
        for (const host of [a, b]) Object.assign(host, { prep: structuredClone(input.prep), _sharp: structuredClone(input.sharp),
          userMods: input.userMods, _filmLook: input.filmLook, aiSkill: s.aiSkill, _qMod: s.qMod, _combo: s.combo });
        for (let age = 0; age < 5; age++) {
          const oldChance = b.moveChance(act);
          assert.equal(a.moveChance(act), oldChance, `${frame}/${act.role}/${act.t}/${age}`);
          const explained = K.ngKnowledgeExplainMove(profile, { ruleset: frame, positionKey: pk, techniqueKey: tk,
            opponentValue: a.oppVal(a.nodes[a.currentPos]), aiSkill: s.aiSkill, qMod: age ? 0 : s.qMod,
            combo: s.combo, arrivalAge: age }, act);
          assert.equal(explained.status, "ready"); assert.equal(explained.chance, oldChance, `profile ${act.t}/${age}`);
          a.decaySharp(); b.decaySharp(); a._qMod = b._qMod = 0;
          counts.attacks++;
        }
        // Existing tagged draw count and <= boundary remain exact. The prior
        // method supplies the oracle, not a second copy of weight arithmetic.
        for (const branch of [undefined, false, true]) for (const draw of [0, .1, .5, .999999999, 1]) {
          const seenA = [], seenB = [], fxA = [], fxB = [];
          a.rng = tag => { seenA.push(tag); return draw; }; b.rng = tag => { seenB.push(tag); return draw; };
          a.fx = (...v) => fxA.push(v); b.fx = (...v) => fxB.push(v);
          assert.equal(a.drawOutcome(act, branch), b.drawOutcome(act, branch));
          assert.deepEqual(seenA, seenB); assert.deepEqual(fxA, fxB); counts.outcomeDraws++;
        }
      }
    }
  }
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(read("source/quartz/static/neural/" + String(url))) });
  a._dataBase = () => "";
  try {
    for (const sub of a.nodes.filter(n => n.rep && n.ty === "submissions")) await a.loadSubmissionChoices(sub);
  } finally { globalThis.fetch = fetchBefore; }
  for (const frame of ["gi", "nogi"]) for (const sub of a.nodes.filter(n => n.rep && n.ty === "submissions")) {
    a._giMode = b._giMode = frame;
    if (!a.rsAllows(sub)) continue;
    a.playerRole = b.playerRole = sub.fromRole === "top" ? "bottom" : "top";
    a._defendSub = b._defendSub = sub.idx;
    const origin = a.techniqueOrigin(sub, "defender"), positionKey = a.deckKeyFor(a.nodes[origin.idx]).key;
    const defenderKey = a.defendKeyFor(sub), escapes = a.submissionDefenses(sub);
    assert.ok(escapes.length, `nonzero escape denominator ${sub.t}/${frame}`);
    for (const panicKey of [null, positionKey]) for (const s of scenarios) for (const opt of escapes) {
      const input = { prep: { [defenderKey]: s.prep, [positionKey]: 1 }, sharp: { [defenderKey]: s.sharp, [positionKey]: .05 } };
      const profile = K.ngKnowledgeBuildProfile(input);
      for (const host of [a, b]) Object.assign(host, { prep: input.prep, _sharp: input.sharp, _panicKey: panicKey,
        aiSkill: s.aiSkill, _combo: s.combo, _qMod: s.qMod, _filmLook: { [sub.t]: s.film }, userMods: [{ name: sub.t, on: true, pct: s.pct || 75 }] });
      const expected = b.escapeChance(opt);
      assert.equal(a.escapeChance(opt), expected);
      const result = K.ngKnowledgeExplainEscape(profile, { ruleset: frame, defenderKey, panicKey,
        destinationValue: a.myVal(a.nodes[opt.res] || opt.node), submissionValue: a.myVal(sub),
        aiSkill: s.aiSkill, combo: s.combo, qMod: s.qMod }, sub);
      assert.equal(result.chance, expected, `escape ${sub.t}/${frame}/${opt.label}`); counts.escapes++;
    }
  }
  for (const [key, n] of Object.entries(counts)) assert.ok(n > 0, `coverage ${key}`);
  console.log(JSON.stringify({ sourceCommit: baseline.commit, sourceSha256: baseline.sha256,
    wireSha256: createHash("sha256").update(wireText).digest("hex"), roleTechniques: techs.length, counts,
    maxRssKiB: process.resourceUsage().maxRSS }));
});

test("missing/empty/zero outcomes and exact boundaries preserve draw order; malformed inputs preserve arithmetic", () => {
  const a = Object.create(C.prototype), b = { ...prior };
  let drawsA = 0, drawsB = 0;
  a._combo = b._combo = 5; a.fx = b.fx = () => {};
  for (const act of [null, {}, { cal: { outcomes: [] } }, { cal: { outcomes: [{ probability: 0, result: "counter" }] } },
    { cal: { outcomes: [{ probability: "bad", result: "failure" }, { probability: 30, result: "success" }] } },
    { cal: { outcomes: [{ probability: 0, result: "failure" }, { probability: 20, result: "failure" }, { probability: 30, result: "counter" }] } }]) {
    for (const branch of [undefined, true, false]) for (const draw of [0, .5, 1]) {
      a.rng = () => { drawsA++; return draw; }; b.rng = () => { drawsB++; return draw; };
      assert.equal(a.drawOutcome(act, branch), b.drawOutcome(act, branch)); assert.equal(drawsA, drawsB);
    }
  }
  assert.ok(drawsA > 0);
  for (const count of [undefined, null, 0, -2, .5, 1000, NaN, Infinity, "2"]) assert.equal(K.ngKnowledgeMastery(count), prior.mastery.call({ prep: { k: count } }, "k"));
});
