import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import * as S from "../neural/src/knowledge-scenarios.src.js";

const A = "Mount|Top", B = "Mount|Bottom", C = "Armbar from Mount|Attacker", D = "Armbar from Mount|Defender";
const roles = { [A]: "Top", [B]: "Bottom", [C]: "Attacker", [D]: "Defender" };
function rehashProfile(p) { delete p.fingerprint; p.fingerprint = K.ngKnowledgeFingerprint(p); return p; }
function sealManifest(job, hash = S.ngKnowledgeScenarioManifestHash) {
  const content = K.ngKnowledgeFingerprint(job.manifest.deckIndex);
  job.manifest.identity.contentRevision = content;
  job.baselineProfile.contentRevision = content; rehashProfile(job.baselineProfile);
  job.manifest.fingerprint = hash(job.manifest);
  return job;
}
function fixture(shared = {}) {
  // The producer's CANONICAL decoded index (wire-keys `ngWireDeckIndex`), not a raw wire file.
  const deckIndex = { decks: { [A]: { cat: "Position", n: 4 }, [B]: { cat: "Position", n: 2 },
    [C]: { cat: "Submission", n: 3 }, [D]: { cat: "Submission", n: 3 } }, shared };
  const job = { baselineProfile: structuredClone(K.ngKnowledgeBuildProfile({ prep: { [A]: 1 }, sharp: { [A]: .025 },
    revision: 7, evidenceRevision: "actual-evidence", contentRevision: K.ngKnowledgeFingerprint(deckIndex), day: 100,
    userMods: [{ name: "Armbar from Mount", on: true, pct: 48 }], filmLook: { "Armbar from Mount": 1 },
    flowCounts: { [A]: { 7: [5, 2] } } })), logicalContextHash: "logical-actual-context-1", ruleset: "gi", day: 100,
    manifest: { version: 1, status: "ready", deckIndex,
      identity: { contentRevision: "", graphHash: "actual-graph-1", decks: Object.fromEntries(Object.keys(roles).map(key =>
        [key, { role: roles[key], category: key === A || key === B ? "Position" : "Submission", rulesets: { gi: true, nogi: true } }])) } },
    targets: [{ deckKey: A, role: "Top", permanentTo: .06 }],
    bounds: { maxTargets: 8, maxDecks: 8, maxSharedGroups: 8, maxSharedMemberships: 32 } };
  return sealManifest(job);
}
function target(key, permanentTo, sharpTo) {
  return { deckKey: key, role: roles[key], ...(permanentTo == null ? {} : { permanentTo }), ...(sharpTo == null ? {} : { sharpTo }) };
}
function ready(job, project = S.ngKnowledgeScenarioProject) {
  const result = project(job); assert.equal(result.status, "ready", result.reason); return result;
}
function unavailable(job, reason, project = S.ngKnowledgeScenarioProject) {
  const r = project(job); assert.equal(r.status, "unavailable"); assert.equal(r.scenario, null);
  if (reason) assert.equal(r.reason, reason); return r;
}
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
const counts = { roleFrames: 0, transitionFrames: 0, mutationsKilled: 0, invalidCases: 0 };

test("all physical/actor roles in both explicit frames produce complete bounded declared changes", () => {
  for (const ruleset of ["gi", "nogi"]) for (const key of [A, B, C, D]) {
    const job = fixture(); job.ruleset = ruleset; job.targets = [target(key, .09, .08)];
    const r = ready(job), p = r.scenario.profile;
    assert.equal(r.provenance.ruleset, ruleset);
    assert.equal(r.provenance.kind, "hypothetical-knowledge-input");
    assert.equal(r.provenance.targetSemantics, "declared-mechanics-input-no-earned-credit");
    assert.equal(r.scenario.deckKeys[0].role, roles[key]);
    assert.deepEqual(r.scenario.changes.records, [
      { deckKey: key, role: roles[key], component: "permanent", from: job.baselineProfile.permanent[key] || 0, to: .09 },
      { deckKey: key, role: roles[key], component: "sharp", from: job.baselineProfile.sharp[key] || 0, to: .08 },
    ]);
    const { fingerprint, ...body } = p;
    assert.equal(fingerprint, K.ngKnowledgeFingerprint(body)); assert.notEqual(fingerprint, job.baselineProfile.fingerprint);
    assert.equal(r.scenario.profileHash, fingerprint); counts.roleFrames++;
  }
  assert.equal(counts.roleFrames, 8);
});

test("transition Attacker/Defender identities use the full title in both frames", () => {
  for (const ruleset of ["gi", "nogi"]) for (const role of ["Attacker", "Defender"]) {
    const j = fixture(), key = "Knee Slice Pass from Half Guard|" + role;
    j.ruleset = ruleset; j.manifest.deckIndex.decks[key] = { cat: "Transition", n: 2 };
    j.manifest.identity.decks[key] = { role, category: "Transition", rulesets: { gi: true, nogi: true } };
    sealManifest(j); j.targets = [{ deckKey: key, role, permanentTo: .03 }];
    const r = ready(j); assert.equal(r.scenario.changes.records[0].deckKey, key);
    assert.equal(r.scenario.changes.records[0].role, role); counts.transitionFrames++;
  }
  assert.equal(counts.transitionFrames, 4);
});

test("projection preserves baseline, every non-target map and non-study context; output is deeply immutable", () => {
  const job = fixture(), before = structuredClone(job), r = ready(job);
  assert.deepEqual(job, before); assert.equal(Object.isFrozen(job), false);
  const p = r.scenario.profile;
  for (const key of Object.keys(before.baselineProfile).filter(k => !["permanent", "fingerprint"].includes(k))) {
    assert.deepEqual(p[key], before.baselineProfile[key], key);
  }
  assert.deepEqual(p.permanent, { [A]: .06 }); // unchanged absent bonuses stay absent
  assert.equal(p.revision, 7); assert.equal(p.evidenceRevision, "actual-evidence"); assert.equal(p.day, 100);
  assert.equal(r.provenance.logicalContextHash, job.logicalContextHash);
  frozen(r); assert.throws(() => { p.permanent[A] = 1; }, TypeError);
  assert.deepEqual(ready(job), r);
});

test("fingerprints bind actual baseline inputs, content, explicit day and logical/frame/graph identities", () => {
  const job = fixture(), r = ready(job);
  for (const field of ["revision", "evidenceRevision", "userMods", "filmLook", "flowCounts"]) {
    const j = structuredClone(job);
    j.baselineProfile[field] = field === "revision" ? 8 : field === "evidenceRevision" ? "next" : field === "userMods" ? [] : {};
    unavailable(j, "baseline-fingerprint-mismatch"); rehashProfile(j.baselineProfile);
    assert.notEqual(ready(j).scenario.id, r.scenario.id);
  }
  for (const mutate of [j => { j.logicalContextHash = "other-context"; }, j => { j.ruleset = "nogi"; },
    j => { j.day = j.baselineProfile.day = 101; rehashProfile(j.baselineProfile); },
    j => { j.manifest.identity.graphHash = "other-graph"; sealManifest(j); }]) {
    const j = structuredClone(job); mutate(j); assert.notEqual(ready(j).scenario.id, r.scenario.id);
  }
  const stale = structuredClone(job); stale.day = 101; unavailable(stale, "stale-profile-day");
  const extra = structuredClone(job); extra.baselineProfile.qMod = -.04; rehashProfile(extra.baselineProfile);
  unavailable(extra, "invalid-baseline-profile");
});

function probeJoint(project = S.ngKnowledgeScenarioProject) {
  const job = fixture(); job.baselineProfile.permanent[A] = .12; job.baselineProfile.sharp[A] = .07;
  rehashProfile(job.baselineProfile); job.targets = [target(A, .15, .10)];
  const r = ready(job, project), d = r.scenario.deckKeys[0];
  assert.deepEqual(d.componentHeadroom, { permanent: .15 - .12, sharp: .10 - .07 });
  assert.equal(d.headroom, (.15 - .12) + (.10 - .07));
  assert.equal(d.headroom, d.jointDelta); assert.ok(d.jointDelta > .059 && d.jointDelta < .061);
  assert.equal(d.headroomSemantics, "joint-permanent-plus-sharp-input-capacity");
  return r;
}
test("component and joint headroom are distinct; .03 plus .03 consumes about .06", () => {
  probeJoint();
  assert.deepEqual(S.NG_KNOWLEDGE_SCENARIO_CAPS, { permanent: K.ngKnowledgeMastery(100), sharp: .10 });
  const job = fixture(); job.baselineProfile.permanent[A] = .12; job.baselineProfile.sharp[A] = .10;
  rehashProfile(job.baselineProfile); job.targets = [target(A, .15, .13)];
  unavailable(job, "target-outside-component-headroom");
  job.targets = [target(A, .15)];
  const d = ready(job).scenario.deckKeys[0]; assert.equal(d.headroom, .15 - .12); assert.equal(d.componentHeadroom.sharp, 0);
});

test("caps are strict at the next representable excess; decreases and invalid baselines are unavailable", () => {
  for (const t of [target(A, .15000000000000002), target(A, null, .10000000000000002),
    target(A, .02), target(A, null, .02)]) {
    const job = fixture(); job.targets = [t]; unavailable(job, "target-outside-component-headroom"); counts.invalidCases++;
  }
  for (const [component, value] of [["permanent", -.03], ["permanent", .16], ["sharp", -.025], ["sharp", .101]]) {
    const j = fixture(); j.baselineProfile[component][A] = value; rehashProfile(j.baselineProfile);
    unavailable(j, "baseline-outside-component-caps"); counts.invalidCases++;
  }
});

test("continuous targets declare simulator input, not integer prep or a successful grade", () => {
  const job = fixture(); job.targets = [target(A, .047, .041)]; const r = ready(job);
  assert.equal(r.scenario.profile.permanent[A], .047); assert.equal(r.scenario.profile.sharp[A], .041);
  assert.equal(r.scenario.profile.evidenceRevision, job.baselineProfile.evidenceRevision);
  for (const name of ["prep", "stage", "srs", "rec", "attemptId", "earnedCredit"]) assert.equal(name in r.scenario.profile, false);
  job.targets[0].earnedCredit = 1; unavailable(job, "invalid-or-duplicate-target");
});

const chain = () => fixture({ "00000001": [0, 1], "00000002": [1, 2] });
function probeClosure(project = S.ngKnowledgeScenarioProject) {
  const job = chain();
  const r = unavailable(job, "missing-shared-closure", project);
  assert.deepEqual(r.details.deckKeys, [C, B].sort());
}
test("shared permanent changes require transitive closure; no implicit rewards or partial scenarios", () => {
  probeClosure();
  const job = chain(); job.targets.push(target(B, .03));
  assert.deepEqual(unavailable(job, "missing-shared-closure").details.deckKeys, [C]);
  job.targets.push(target(C, .027));
  const r = ready(job);
  assert.deepEqual(r.provenance.sharedClosure.deckKeys, [A, B, C].sort().map(k => ({ deckKey: k, role: roles[k] })));
  assert.equal(r.scenario.profile.permanent[B], .03); assert.equal(r.scenario.profile.permanent[C], .027);
  assert.equal(r.scenario.profile.sharp[B], undefined); assert.equal(r.scenario.profile.sharp[C], undefined);
  assert.deepEqual(r.scenario.changes.records.map(x => x.to), [.027, .03, .06]);
});

test("capped and held-fixed shared peers must explicitly declare permanentTo, but do not invent change records", () => {
  const job = chain(); job.baselineProfile.permanent[B] = .15; rehashProfile(job.baselineProfile);
  job.targets = [target(A, .06), target(B, null, .05), target(C, 0)];
  unavailable(job, "missing-shared-closure");
  job.targets = [target(A, .06), target(B, .15), target(C, 0)];
  const r = ready(job);
  assert.equal(r.provenance.sharedClosure.deckKeys.length, 3);
  assert.equal(r.scenario.deckKeys.length, 1); assert.equal(r.scenario.changes.records.length, 1);
  assert.equal(r.scenario.profile.permanent[B], .15);
  assert.equal(Object.hasOwn(r.scenario.profile.permanent, C), false, "explicit unchanged zero does not alter profile shape");
});

test("sharp-only targets stay local even when the manifest lists shared questions", () => {
  const job = chain(); job.targets = [target(A, null, .10)]; const r = ready(job);
  assert.deepEqual(r.provenance.sharedClosure.deckKeys, []);
  assert.deepEqual(r.scenario.profile.permanent, job.baselineProfile.permanent);
  assert.deepEqual(r.scenario.profile.sharp, { [A]: .10 }); assert.equal(r.scenario.changes.records.length, 1);
});

test("inactive-frame shared peers remain declared; standalone inactive or shared-sharp effects are rejected", () => {
  const job = chain(); job.ruleset = "nogi"; job.manifest.identity.decks[B].rulesets.nogi = false;
  sealManifest(job); job.targets = [target(A, .06), target(B, .03), target(C, 0)];
  const r = ready(job), d = r.scenario.deckKeys.find(d => d.deckKey === B);
  assert.equal(d.available, false); assert.equal(d.role, "Bottom");
  assert.equal(r.scenario.profile.permanent[B], .03);
  const lone = structuredClone(job); lone.targets = [target(B, .03)]; unavailable(lone, "target-unavailable-in-ruleset");
  job.targets[1].sharpTo = .10; unavailable(job, "inactive-sharp-target");
});

test("target order is immaterial; no-op hypotheses and duplicate/partial role declarations are rejected", () => {
  const job = chain(); job.targets = [target(A, .06), target(B, .03), target(C, .05)];
  const r = ready(job); job.targets.reverse(); assert.deepEqual(ready(job), r);
  const no = fixture(); no.targets = [target(A, .03, .025)]; unavailable(no, "no-profile-changes");
  for (const targets of [[target(A, .06), target(A, null, .1)], [{ deckKey: A, role: "Top" }],
    [target("not a manifest key", .03)]]) {
    const j = fixture(); j.targets = targets; unavailable(j); counts.invalidCases++;
  }
  const wrong = fixture(); wrong.targets[0].role = "Attacker"; unavailable(wrong, "target-role-mismatch");
});

test("shared ordinal ordering is bound even when canonical raw content fingerprint does not change", () => {
  const job = fixture({ "00000001": [0, 2] }); job.targets = [target(A, null, .1)];
  const oldContent = K.ngKnowledgeFingerprint(job.manifest.deckIndex), oldHash = job.manifest.fingerprint;
  const raw = job.manifest.deckIndex.decks;
  job.manifest.deckIndex.decks = { [B]: raw[B], [A]: raw[A], [C]: raw[C], [D]: raw[D] };
  assert.equal(K.ngKnowledgeFingerprint(job.manifest.deckIndex), oldContent);
  assert.notEqual(S.ngKnowledgeScenarioManifestHash(job.manifest), oldHash);
  unavailable(job, "manifest-fingerprint-mismatch");
});

test("missing or tampered loaded manifest, sharing, graph and physical/actor metadata never yield inferred identity", () => {
  const operations = [
    j => { j.manifest.status = "loading"; },
    j => { delete j.manifest.deckIndex.shared; },
    j => { delete j.manifest.identity.decks[B]; sealManifest(j); },
    j => { j.manifest.identity.graphHash = ""; sealManifest(j); },
    j => { j.manifest.identity.decks[A].role = "Attacker"; sealManifest(j); },
    j => { j.manifest.identity.decks[A].category = "Submission"; sealManifest(j); },
    j => { delete j.manifest.identity.decks[A].rulesets.gi; sealManifest(j); },
    j => { j.manifest.identity.decks[A].rulesets.gi = 1; sealManifest(j); },
    j => { j.manifest.identity.decks[A].rulesets.gi = false; }, // cannot change authoritative metadata under an old hash
    j => { j.manifest.deckIndex.shared["00000003"] = [2, 3]; }, // content changed under baseline
    j => { j.manifest.fingerprint = "forged"; },
  ];
  for (const mutate of operations) { const job = fixture(); mutate(job); unavailable(job); counts.invalidCases++; }
});

test("malformed shared groups and exceeding any caller admission bound fail the whole projection", () => {
  for (const group of [[0], [0, 0], [0, 4], [-1, 1], [.5, 1], [0, "1"]]) {
    unavailable(fixture({ "00000001": group }), "invalid-shared-index"); counts.invalidCases++;
  }
  unavailable(fixture({ "bad-hash": [0, 1] }), "invalid-shared-index");
  const tests = [
    j => { j.bounds.maxDecks = 3; },
    j => { j.bounds.maxTargets = 1; j.targets.push(target(B, .03)); },
    j => { j.bounds.maxSharedGroups = 1; },
    j => { j.bounds.maxSharedMemberships = 3; },
    j => { j.bounds.maxTargets = 0; },
    j => { delete j.bounds; },
  ];
  for (const mutate of tests) { const job = chain(); mutate(job); unavailable(job); counts.invalidCases++; }
});

test("nonfinite, cyclic, accessors and non-JSON input fail without invoking getters or changing input", () => {
  for (const value of [NaN, Infinity, -Infinity, undefined, null, "0.06"]) {
    const job = fixture(); job.targets[0].permanentTo = value; unavailable(job); counts.invalidCases++;
  }
  let called = false; const getter = fixture();
  Object.defineProperty(getter.targets[0], "sharpTo", { enumerable: true, get() { called = true; return .1; } });
  unavailable(getter, "non-json-scenario-input"); assert.equal(called, false);
  const cyclic = fixture(); cyclic.manifest.deckIndex.decks[A].self = cyclic;
  unavailable(cyclic, "non-json-scenario-input");
  const sparse = fixture(); sparse.targets = new Array(2); sparse.targets[1] = target(A, .06);
  unavailable(sparse, "non-json-scenario-input");
  const symbol = fixture(); symbol.targets[0][Symbol("hidden change")] = 1;
  unavailable(symbol, "non-json-scenario-input");
  const hidden = fixture(); Object.defineProperty(hidden.targets[0], "extra", { value: 1 });
  unavailable(hidden, "non-json-scenario-input");
  for (const input of [null, undefined, [], new Date(), false]) unavailable(input);
});

test("declarations are the exact entire profile delta and contain no hidden unchanged components", () => {
  const job = chain(); job.targets = [target(A, .047, .10), target(B, .015), target(C, .015, .03), target(D, null, .02)];
  const r = ready(job), expected = [];
  for (const key of Object.keys(roles).sort()) for (const component of ["permanent", "sharp"]) {
    const from = job.baselineProfile[component][key] || 0, to = r.scenario.profile[component][key] || 0;
    if (from !== to) expected.push({ deckKey: key, role: roles[key], component, from, to });
  }
  assert.equal(expected.length, 6); assert.deepEqual(r.scenario.changes.records, expected);
  for (const d of r.scenario.deckKeys) {
    const delta = expected.filter(c => c.deckKey === d.deckKey).reduce((n, c) => n + c.to - c.from, 0);
    assert.ok(Math.abs(delta - d.jointDelta) < 1e-16);
  }
});

const source = readFileSync(new URL("../neural/src/knowledge-scenarios.src.js", import.meta.url), "utf8");
function mutant(marker, replacement) {
  assert.equal(source.split(marker).length, 2, "unique production mutation site");
  const text = source.replace(marker, replacement).replace(/^import[\s\S]*?from "\.\/knowledge-profile\.src\.js";\n/m, "")
    .replace(/^export /gm, "");
  return new Function("NG_KNOWLEDGE_VERSION", "NG_KNOWLEDGE_STUDY_POLICY", "ngKnowledgeFingerprint", "ngKnowledgeMastery",
    text + "\nreturn ngKnowledgeScenarioProject;")(K.NG_KNOWLEDGE_VERSION, K.NG_KNOWLEDGE_STUDY_POLICY, K.ngKnowledgeFingerprint, K.ngKnowledgeMastery);
}
test("independent semantic probes kill shared-closure omission, reused per-component headroom and stale fingerprint mutants", () => {
  const noClosure = mutant('ngKnowledgeScenarioRequire(!missing.length, "missing-shared-closure", { deckKeys: missing });', "");
  assert.throws(() => probeClosure(noClosure), assert.AssertionError); counts.mutationsKilled++;
  const wrongJoint = mutant("const headroom = componentHeadroom.permanent + componentHeadroom.sharp;",
    "const headroom = Math.max(componentHeadroom.permanent, componentHeadroom.sharp);");
  assert.throws(() => probeJoint(wrongJoint), assert.AssertionError); counts.mutationsKilled++;
  const oldFingerprint = mutant("profile.fingerprint = ngKnowledgeFingerprint(profile);", "profile.fingerprint = p.fingerprint;");
  const probeFingerprint = (project) => {
    const r = ready(fixture(), project), { fingerprint, ...body } = r.scenario.profile;
    assert.equal(fingerprint, K.ngKnowledgeFingerprint(body));
  };
  probeFingerprint(S.ngKnowledgeScenarioProject);
  assert.throws(() => probeFingerprint(oldFingerprint), assert.AssertionError); counts.mutationsKilled++;
  assert.equal(counts.mutationsKilled, 3);
});

after(() => console.log(JSON.stringify({ fixtureCoverage: counts, maxRssKiB: process.resourceUsage().maxRSS })));
