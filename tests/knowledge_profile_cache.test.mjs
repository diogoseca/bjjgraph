import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { ngFlowBuild, ngFlowScore } from "../neural/src/flow.src.js";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const source = read("neural/src/app.src.jsx");
const flowSource = read("neural/src/flow.src.js");
const C = new Function("DCLogic", "React", knowledgeSource + "\n" + source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
function app() {
  const a = Object.create(C.prototype);
  Object.assign(a, { settings: {}, beats: [], get: (_k, d) => d, set() {}, track() {}, _saveProgress() {}, renderTabSubtitles() {} });
  a.ingest(JSON.parse(read("source/quartz/static/neural/graph-data.json")));
  return a;
}
function isolatedKernelExports(text) {
  return new Function(text.replace(/^export /gm, "") + "\nreturn {ngFlowScore,ngFlowBuild};")();
}
function checkReset(score, build) {
  const a = app(), k = build(a), fresh = build(a);
  const hand = k.hands.find(h => h.some(v => v.ord >= 0)), index = k.hands.indexOf(hand);
  const pk = k.deckKeys[k.posDeck[index]], move = hand.find(v => v.ord >= 0);
  const counts = { [pk]: { [move.ord]: [80, 0] } };
  const warm = score(a, { kernel: k, counts, shortlist: 1, H: 3 });
  assert.ok(warm); assert.equal(k.usePersonal, true);
  const cold = score(a, { kernel: k, shortlist: 1, H: 3 });
  assert.equal(k.usePersonal, false, "missing counts release preceding personalized probabilities");
  const expected = score(a, { kernel: fresh, shortlist: 1, H: 3 });
  const result = ({ kernel, ...values }) => values;
  assert.deepEqual(result(cold), result(expected));
  score(a, { kernel: k, counts, shortlist: 1, H: 3 });
  const empty = score(a, { kernel: k, counts: {}, shortlist: 1, H: 3 });
  assert.deepEqual(result(empty), result(expected));
  return hand.length;
}
test("reused FLOW kernel releases missing/empty personal evidence; regression mutant is killed", () => {
  const coverage = checkReset(ngFlowScore, ngFlowBuild);
  assert.ok(coverage > 0);
  const marker = "K.usePersonal = false; // reused kernel must not retain the preceding profile's rates";
  assert.ok(flowSource.includes(marker));
  const mutant = isolatedKernelExports(flowSource.replace(marker, ""));
  assert.throws(() => checkReset(mutant.ngFlowScore, mutant.ngFlowBuild), /missing counts release/);
  console.log(`personal-reset mutation killed; exercised hand actions: ${coverage}`);
});

function evalApp(text) {
  return new Function("DCLogic", "React", knowledgeSource + "\n" + text + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
}
function expiryProbe(Class) {
  const a = Object.create(Class.prototype); let day = 200;
  a.flow = { d: { p: { 1: [10, 3, 20] } } }; a._epochDay = () => day;
  assert.deepEqual(a.flowCounts(), { p: { 1: [10, 3] } });
  day++;
  assert.deepEqual(a.flowCounts(), {}, "expired counts cannot survive date rollover");
}
test("day-aware cache mutation is killed", () => {
  expiryProbe(C);
  const marker = " && this._flowCache.day === day";
  assert.ok(source.includes(marker));
  assert.throws(() => expiryProbe(evalApp(source.replace(marker, ""))), /expired counts/);
});

test("failed grade still changes profile identity after reload; replace/import invalidates unchanged versions", () => {
  const a = app(); a.flow = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.srs = {};
  const before = a.knowledgeProfile();
  a.srs = { "A|Top": { hash: [9, 1, 8] } }; // imported evidence/reload, no prep change
  const failure = a.knowledgeProfile();
  assert.notEqual(before.fingerprint, failure.fingerprint);
  assert.deepEqual(before.permanent, failure.permanent);
  a.prep = { "A|Top": 3 }; const imported = a.knowledgeProfile();
  a._publishKnowledge("identity-reset"); a.prep = {}; a.srs = {};
  assert.notEqual(a.knowledgeProfile().fingerprint, imported.fingerprint);
});
