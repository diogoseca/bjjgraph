import { bindProgressGuestForTest } from './_progress_owner_harness.mjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
const prior = JSON.parse(readFileSync(new URL("./artifacts/knowledge_profile_prior.json", import.meta.url), "utf8"));
// The old writer closes over its OWN captured declaration, never the new module's ladder.
const old = new Function(prior.declarations.NG_SRS_IVLS + "\nreturn {" + Object.values(prior.methods).join(",\n") + "};")();
const appSource = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + appSource + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-14, `${a} != ${b}`);

test("independent arithmetic: two deck bonuses once, resistance, film, penalty, momentum and both clamps", () => {
  const p = K.ngKnowledgeBuildProfile({ prep: { "Mount|Top": 1, "Armbar|Attacker": 2, "Armbar|Defender": 3 },
    sharp: { "Mount|Top": .10, "Armbar|Attacker": .05, "Armbar|Defender": .025 }, filmLook: { Armbar: 1 } });
  const act = { t: "Armbar", ty: "submissions", dom: 1, cal: { successRate: 50 } };
  const context = { positionKey: "Mount|Top", techniqueKey: "Armbar|Attacker", opponentValue: .5, aiSkill: .1, qMod: -.04, combo: 2 };
  const move = K.ngKnowledgeExplainMove(p, context, act);
  close(move.chance, .465);
  close(move.comparison.chance, .225);
  close(move.comparison.effectiveDelta, .24);
  assert.deepEqual(move.knowledge.components.map(c => c.role), ["Top", "Top", "Attacker", "Attacker"]);
  const escape = K.ngKnowledgeExplainEscape(p, { defenderKey: "Armbar|Defender", destinationValue: .4, submissionValue: -.2, aiSkill: .1, combo: 2 }, act);
  close(escape.chance, .63);
  close(escape.comparison.chance, .515);
  close(K.ngKnowledgeMoveChance({ calibrated: .99, techniqueBonus: .25 }), .95);
  close(K.ngKnowledgeMoveChance({ calibrated: .01, aiSkill: 1 }), .05);
  close(K.ngKnowledgeEscapeChance({ calibrated: 0, defenseBonus: .25 }), .92);
  close(K.ngKnowledgeEscapeChance({ calibrated: 1, aiSkill: 1 }), .08);
  assert.equal(K.ngKnowledgeEscapeChance({ valid: false }), 0);
});

test("override bypass and clamped effective delta never claim sum of component win gains", () => {
  const a = { t: "A", ty: "transitions", dom: 0, cal: { successRate: 94 } };
  const c = { positionKey: "P|Top", techniqueKey: "A|Attacker", opponentValue: 0 };
  const p = K.ngKnowledgeBuildProfile({ prep: { "A|Attacker": 5 }, userMods: [{ name: "A", on: true, pct: 2 }] });
  const r = K.ngKnowledgeExplainMove(p, c, a);
  assert.equal(r.chance, .05); assert.equal(r.knowledge.status, "bypassed");
  assert.equal(r.comparison.effectiveDelta, 0);
  const clamped = K.ngKnowledgeExplainMove(K.ngKnowledgeBuildProfile({ prep: { "A|Attacker": 5 } }), c, a);
  close(clamped.comparison.effectiveDelta, .01); assert.equal(clamped.clamp.applied, true);
  assert.equal(K.ngKnowledgeExplainMove(null, c, a).status, "unavailable");
  assert.equal(K.ngKnowledgeExplainEscape(p, {}, a).status, "unavailable");
  assert.equal(K.ngKnowledgeExplainMove(p, { ...c, positionKey: null }, a).status, "unavailable");
  assert.equal(K.ngKnowledgeExplainEscape(p, { defenderKey: "A|Attacker", destinationValue: 0, submissionValue: 0 }, a).status, "unavailable");
  assert.equal(K.ngKnowledgeCalibrated({ cal: { successRate: 40, successRateByRuleset: { nogi: null } } }, "nogi").provenance, "legacy-null-scalar-fallback");
});

test("snapshot is immutable, deterministic, private and invalidates every declared input", () => {
  const input = { prep: { b: 2, a: 1 }, sharp: { a: .1 }, revision: 3, contentRevision: "v2", day: 12,
    userMods: [], flowCounts: { a: { 2: [1, 1] } }, stage: { secret: "not-worker-data" } };
  const p = K.ngKnowledgeBuildProfile(input);
  assert.ok(Object.isFrozen(p.permanent)); assert.ok(Object.isFrozen(p.flowCounts.a[2]));
  assert.equal(JSON.stringify(p).includes("not-worker-data"), false);
  input.prep.a = 100; assert.equal(p.permanent.a, .03);
  assert.equal(p.fingerprint, K.ngKnowledgeBuildProfile({ ...input, prep: { a: 1, b: 2 } }).fingerprint);
  for (const patch of [{ revision: 4 }, { contentRevision: "v3" }, { day: 13 }, { sharp: {} },
    { prep: {} }, { filmLook: { a: 1 } }, { userMods: [{ name: "a", on: true, pct: 30 }] },
    { flowCounts: {} }, { evidenceRevision: "failed-review" }]) {
    assert.notEqual(K.ngKnowledgeBuildProfile({ ...input, prep: { a: 1, b: 2 }, ...patch }).fingerprint, p.fingerprint);
  }
  assert.equal(K.ngKnowledgeBuildProfile(null).status, "unavailable");
  assert.equal(K.ngKnowledgeBuildProfile({ prep: { a: "corrupt" } }).status, "unavailable");
  assert.equal(K.ngKnowledgeBuildProfile({ sharp: { a: NaN } }).status, "unavailable");
  const hostile = JSON.parse('{"__proto__":5,"constructor":2}');
  const h = K.ngKnowledgeBuildProfile({ prep: hostile });
  assert.equal(K.ngKnowledgeBonus(h, "__proto__").mastery, .15);
  assert.equal({}.polluted, undefined);
});

test("future arrival law exactly matches real prior decay; commit and defense do not imply an arrival", () => {
  let checked = 0;
  for (const value of [0, .1, .075, .05, .025, .001, -.1, .0995, .5, 1.234]) {
    const host = { _sharp: { a: value } };
    for (let age = 0; age < 60; age++) {
      assert.equal(K.ngKnowledgeSharpAfter(value, age), host._sharp.a || 0);
      old.decaySharp.call(host); checked++;
    }
  }
  const p = K.ngKnowledgeBuildProfile({ prep: { a: 9 }, sharp: { a: .1 } });
  let c = { qMod: -.08, combo: 5, arrivalAge: 0, questionPending: true, panicKey: "A|Defender" };
  c = K.ngKnowledgeAdvance(c, { type: "commit" });
  assert.equal(c.combo, 5); assert.equal(c.qMod, -.08); assert.equal(c.questionPending, false);
  c = K.ngKnowledgeAdvance(c, { type: "arrival", first: true });
  assert.equal(c.arrivalAge, 0); assert.equal(c.qMod, 0);
  c = K.ngKnowledgeProject(p, c, 4);
  assert.equal(c.arrivalAge, 4); assert.equal(c.combo, 5);
  assert.deepEqual(K.ngKnowledgeBonus(p, "a", 4), { mastery: .15, sharp: 0, total: .15 });
  assert.equal(K.ngKnowledgeAdvance(c, { type: "expiry", surface: "panic" }).qMod, 0);
  assert.equal(K.ngKnowledgeAdvance(c, { type: "expiry" }).qMod, -.04);
  assert.equal(K.ngKnowledgeAdvance(c, { type: "wrong", tier: "trap" }).qMod, -.08);
  assert.equal(K.ngKnowledgeAdvance(c, { type: "recall-correct" }).combo, 5);
  assert.equal(K.ngKnowledgeAdvance(c, { type: "mc-correct" }).combo, 6);
  for (const surface of ["panic", "jit", "deck", "node"]) for (const type of ["mc-correct", "recall-correct", "wrong"]) {
    assert.deepEqual(K.ngKnowledgeAdvance(c, { type, surface, tier: "trap" }), c);
  }
  console.log(`prior sharpness transitions compared: ${checked}`);
});

function gradeHost(Class = Component) {
  const a = Object.create(Class.prototype);
  bindProgressGuestForTest(a);
  Object.assign(a, { prep: {}, stage: {}, rec: {}, srs: {}, _sharp: {}, _days: {}, beats: [],
    flashcards: { decks: { "A|Top": { n: 2 }, "B|Bottom": { n: 2 } } },
    _epochDay: () => 100, _dayKey: () => "day", get: (_k, d) => d,
    _saveProgress() { this.saved = JSON.stringify({ prep: this.prep, srs: this.srs }); },
    _maybeLessonDone() {}, noteCardAnswered() {}, refreshOptionOdds() {}, track() {}, fx() {},
    renderTabSubtitles() { this.seenAtPublish = structuredClone(this.prep); } });
  a._sharedQ = new Map([[a.qhash("q"), ["A|Top", "B|Bottom"]]]);
  return a;
}
test("atomic host publication, duplicate replay, failure persistence, shared credit before cached/digest reads", async () => {
  const a = gradeHost(); let notified = 0, planned = 0;
  a._onKnowledgeChanged = () => { notified++; assert.equal(a._qMod, -.04); };
  a._onGameplanKnowledgeChanged = () => planned++;
  a.gradeRecall("A|Top", { q: "q" }, true, "attempt:1");
  a._qMod = -.04; // synchronous landing onDone, after evidence transaction
  assert.deepEqual(a.seenAtPublish, { "A|Top": 1, "B|Bottom": 1 });
  assert.equal(a._sharp["B|Bottom"], undefined);
  const revision = a._knowledgeRevision;
  assert.equal(a.gradeRecall("A|Top", { q: "q" }, true, "attempt:1").status, "duplicate");
  assert.equal(a._knowledgeRevision, revision);
  await Promise.resolve(); assert.equal(notified, 1); assert.equal(planned, 1);
  a._onKnowledgeChanged = null;
  a._gradeKnowledge("A|Top", { q: "q" }, false, "mc", "wrong", "attempt:2");
  assert.equal(a.prep["A|Top"], 1); assert.equal(a._knowledgeRevision, revision + 1);
  assert.deepEqual(JSON.parse(a.saved).srs["A|Top"][a.qhash("q")], [101, 1, 100]);
  assert.equal(a.gradeRecall("A|Top", null, true).status, "invalid");
  assert.equal(a.prep["A|Top"], 1);
});

test("destroyed app drops queued evidence and planner callbacks", async () => {
  const a = gradeHost(); let notices = 0;
  a._onKnowledgeChanged = a._onGameplanKnowledgeChanged = () => notices++;
  a._publishKnowledge("test"); a.__ngDestroyed = true;
  await Promise.resolve(); assert.equal(notices, 0);
});

function reportingComponent(warnings) {
  return new Function("DCLogic", "React", "console", knowledgeSource + "\n" + appSource + "\nreturn Component;")
    (class {}, { createRef: () => ({ current: null }) }, { warn: (...args) => warnings.push(args) });
}
function evidenceOf(a) {
  return structuredClone({ prep: a.prep, stage: a.stage, rec: a.rec, srs: a.srs,
    sharp: a._sharp, days: a._days, credited: [...(a.cardDone || [])] });
}
test("renderer and either observer can throw without losing a grade, save or the other observer", async () => {
  let checked = 0;
  for (const correct of [true, false]) for (const failing of ["renderTabSubtitles", "_onKnowledgeChanged", "_onGameplanKnowledgeChanged"]) {
    const warnings = [], a = gradeHost(reportingComponent(warnings));
    const calls = [], fault = new Error(failing); let broken = true, saves = 0;
    a.stage = { "A|Top": { [a.qhash("q")]: 2 } }; a.rec = { "A|Top": 0 };
    a._saveProgress = () => { saves++; a.persisted = evidenceOf(a); };
    for (const name of ["renderTabSubtitles", "_onKnowledgeChanged", "_onGameplanKnowledgeChanged"]) {
      a[name] = () => {
        calls.push(name);
        if (name !== "renderTabSubtitles") assert.deepEqual(a.persisted, evidenceOf(a), "save precedes observers");
        if (broken && name === failing) throw fault;
      };
    }
    const result = a.gradeRecall("A|Top", { q: "q" }, correct, "throw:1");
    assert.equal(result.status, "applied"); assert.equal(saves, 1);
    assert.deepEqual(a.persisted, evidenceOf(a));
    assert.equal(a.stage["A|Top"][a.qhash("q")], correct ? 3 : 1);
    assert.deepEqual(a.srs["B|Bottom"][a.qhash("q")], [101, 1, 100]);
    await Promise.resolve();
    assert.deepEqual(calls, ["renderTabSubtitles", "_onKnowledgeChanged", "_onGameplanKnowledgeChanged"]);
    assert.equal(warnings.length, 1); assert.equal(warnings[0][1], fault);
    assert.match(warnings[0][0], new RegExp(failing + " failed"));
    const revision = a._knowledgeRevision;
    assert.equal(a.gradeRecall("A|Top", { q: "q" }, correct, "throw:1").status, "duplicate");
    assert.equal(a._knowledgeRevision, revision); assert.equal(saves, 1);
    await Promise.resolve(); assert.equal(calls.length, 3);
    broken = false;
    a.gradeRecall("A|Top", { q: "q" }, true, "throw:2");
    await Promise.resolve(); assert.equal(calls.length, 6); assert.equal(saves, 2);
    assert.equal(warnings.length, 1); checked++;
  }
  console.log(`renderer/observer fault cases with persisted replay-safe grades: ${checked}`);
});

test("optional grade effects report failures independently and still save final shared/digest evidence", () => {
  const warnings = [], a = gradeHost(reportingComponent(warnings));
  const h = a.qhash("q"); a.stage = { "A|Top": { [h]: 2 } };
  a.get = (key, fallback) => key === "emailDigest" ? true : fallback;
  a.gameScore = () => ({ score: (a.prep["A|Top"] + a.prep["B|Bottom"]) / 10 });
  a.weakSpots = () => null;
  const calls = [];
  for (const name of ["fx", "track", "_maybeLessonDone", "noteCardAnswered", "refreshOptionOdds"]) {
    a[name] = (...args) => { calls.push([name, ...args]); throw new Error(name); };
  }
  a._saveProgress = () => { a.persisted = { evidence: evidenceOf(a), dayLog: structuredClone(a.dayLog) }; };
  assert.equal(a.gradeRecall("A|Top", { q: "q" }, true, "effects:1").status, "applied");
  assert.deepEqual(a.persisted.evidence, evidenceOf(a));
  assert.deepEqual(a.persisted.dayLog, { day: { s: 20, k: ["A|Top"] } });
  assert.equal(a.rec["A|Top"], 1); assert.equal(a.prep["B|Bottom"], 1);
  assert.deepEqual(warnings.map(w => w[0]), ["recall_proven", "lesson-completion", "card-analytics",
    "bonus_pumped", "card-answered", "option-odds"].map(name => `[neural] knowledge ${name} failed:`));
  assert.equal(calls.length, 6);
});

test("async observer rejection is reported and cannot block Gameplan or later notifications", async () => {
  const warnings = [], a = gradeHost(reportingComponent(warnings)); let plans = 0;
  const fault = new Error("async observer");
  a._onKnowledgeChanged = async () => { throw fault; };
  a._onGameplanKnowledgeChanged = () => plans++;
  for (let i = 0; i < 2; i++) {
    a.gradeRecall("A|Top", { q: "q" }, true, "async:" + i);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(plans, i + 1); assert.equal(warnings.length, i + 1);
    assert.equal(warnings[i][1], fault);
    assert.match(warnings[i][0], /_onKnowledgeChanged failed/);
  }
});

test("SRS differential closes over the captured original ladder; changed-constant mutant is killed", () => {
  assert.equal(prior.declarations.NG_SRS_IVLS, "const NG_SRS_IVLS = [1, 3, 7, 14, 30, 60, 120];");
  assert.deepEqual(K.NG_KNOWLEDGE_INTERVALS, [1, 3, 7, 14, 30, 60, 120]);
  function compare(schedule) {
    let checked = 0;
    for (const day of [0, 100]) for (const interval of [null, 1, 3, 7, 14, 30, 60, 120, 2]) for (const correct of [true, false]) {
      const row = interval == null ? undefined : [99, interval, 90];
      const a = { srs: { A: { [old.qhash("q")]: row } }, qhash: old.qhash,
        _epochDay: () => day, _sharedDecksFor: () => null };
      old._schedule.call(a, "A", "q", correct);
      assert.deepEqual(schedule(row, correct, day), a.srs.A[old.qhash("q")], "captured SRS ladder");
      checked++;
    }
    return checked;
  }
  assert.equal(compare(K.ngKnowledgeScheduleRow), 36);
  const marker = "Object.freeze([1, 3, 7, 14, 30, 60, 120])";
  assert.equal(knowledgeSource.split(marker).length, 2);
  const mutated = new Function(knowledgeSource.replace(marker, "Object.freeze([1, 4, 7, 14, 30, 60, 120])") + "\nreturn ngKnowledgeScheduleRow;")();
  assert.throws(() => compare(mutated), /captured SRS ladder/);
  console.log("captured SRS rows compared: 36; changed-constant mutant killed");
});

// Execute the actual listener registrations, including the closures' local action/timer
// steps. The prior snippets are exact original source, not a rewritten fallback oracle.
function recallHandlers(text, surface) {
  const container = surface === "jit" ? "jit" : "card";
  const begin = `const rv = ${container}.querySelector("[data-${surface}-reveal]"), gt = `;
  assert.equal(text.split(begin).length, 2, `${surface} callback coverage`);
  const at = text.indexOf(begin);
  const end = surface === "jit" ? "\n        };\n        // A wrong MC answer" : "\n      if (!this._panicWarmTried)";
  const stop = text.indexOf(end, at); assert.ok(stop > at);
  const code = text.slice(at, stop).trimEnd();
  assert.equal(code.split('gt.addEventListener("click"').length, 2);
  return code;
}
function bindRecallFallback(a, surface, code, key, question) {
  const button = () => ({ style: {}, disabled: false, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { assert.equal(typeof this.listeners.click, "function"); this.listeners.click({ stopPropagation() {} }); } });
  const reveal = button(), got = button(), answer = { style: { display: "none" } };
  const container = { querySelector(selector) {
    if (selector === `[data-${surface}-reveal]`) return reveal;
    if (selector === `[data-${surface}-got]`) return got;
    assert.equal(selector, surface === "jit" ? ".jitAns" : ".pAns"); return answer;
  } };
  const action = name => { a.actions[name] = (a.actions[name] || 0) + 1; };
  let touched;
  if (surface === "jit") {
    touched = new Function("jit", "jitKey", "card", "banked", "let touched = false;\n" + code + "\nreturn () => touched;")
      .call(a, container, key, question, () => action("banked"));
  } else {
    touched = new Function("card", "pk", "fc", "idx", "row", "render", "let touched = false;\n" + code + "\nreturn () => touched;")
      .call(a, container, key, question, 0, {}, () => action("render"));
  }
  return { reveal, got, answer, touched };
}
test("JIT/panic plain recall deliberately qualifies proof/SRS; direct callbacks retain credit, sharing, clocks and replay bounds", async () => {
  let checked = 0;
  for (const surface of ["jit", "panic"]) for (const hydrated of [false, true]) {
    const role = surface === "jit" ? "Attacker" : "Defender";
    const key = `A|${role}`, shared = `B|${role}`, question = { q: "q", a: "answer" };
    const a = gradeHost(), b = gradeHost(), qh = a.qhash("q");
    for (const [name, fn] of Object.entries(old)) b[name] = fn;
    b._bumpStageVer = () => {};
    for (const host of [a, b]) {
      Object.assign(host, { prep: {}, rec: { [key]: 0, [shared]: 0 },
        stage: { [key]: { [qh]: 2 }, [shared]: { [qh]: 1 } },
        srs: { [key]: { [qh]: [90, 7, 83] }, [shared]: { [qh]: [70, 3, 67] } },
        flashcards: { decks: { [key]: { cards: [question] },
          [shared]: hydrated ? { cards: [question, { q: "other" }] } : { n: 2 } } },
        _sharedQ: new Map([[qh, [key, shared]]]), _qMod: -.08, _combo: 4, _jitIdx: {},
        actions: {}, answers: 0, saves: 0,
        noteCardAnswered() { this.answers++; },
        _saveProgress() { this.saves++; this.persisted = evidenceOf(this); },
        _disarmLandClock() { this.actions.disarm = (this.actions.disarm || 0) + 1; },
        refreshEscapeOdds() { this.actions.escape = (this.actions.escape || 0) + 1; },
        _dockLandCard() { this.actions.dock = (this.actions.dock || 0) + 1; },
        setBeacon() { this.actions.beacon = (this.actions.beacon || 0) + 1; } });
    }
    const currentCode = recallHandlers(appSource, surface);
    const now = bindRecallFallback(a, surface, currentCode, key, question);
    const before = bindRecallFallback(b, surface, prior.callbacks[surface + "Recall"], key, question);
    for (const [host, ui] of [[a, now], [b, before]]) {
      const initial = evidenceOf(host);
      ui.reveal.click(); assert.equal(ui.touched(), true); assert.equal(ui.answer.style.display, "block");
      assert.deepEqual(evidenceOf(host), initial, "reveal is not a grade"); assert.equal(host.saves, 0);
      ui.got.click();
    }
    assert.deepEqual(a.prep, b.prep); assert.deepEqual(a.prep, { [key]: 1, [shared]: 1 });
    assert.deepEqual(a._sharp, b._sharp); assert.deepEqual(a._sharp, { [key]: .1 });
    assert.deepEqual(a._days, b._days); assert.deepEqual(a.actions, b.actions);
    assert.equal(b.stage[key][qh], 2); assert.equal(b.rec[key], 0);
    assert.equal(a.stage[key][qh], 3); assert.equal(a.rec[key], 1);
    assert.equal(a.stage[shared][qh], 1); assert.equal(a.rec[shared], 0);
    assert.deepEqual(b.srs, { [key]: { [qh]: [90, 7, 83] }, [shared]: { [qh]: [70, 3, 67] } });
    assert.deepEqual(a.srs, { [key]: { [qh]: [114, 14, 100] }, [shared]: { [qh]: [107, 7, 100] } });
    assert.equal(b.answers, 0); assert.equal(a.answers, 1);
    assert.deepEqual(a.persisted, evidenceOf(a), "save contains all shared changes");
    assert.equal(a._qMod, -.08); assert.equal(a._combo, 4); assert.equal(b._qMod, -.08); assert.equal(b._combo, 4);
    assert.equal(Object.values(a._knowledgeAttempts)[0].surface, surface);
    assert.equal(now.got.disabled, true);
    const first = evidenceOf(a), actions = structuredClone(a.actions), revision = a._knowledgeRevision;
    now.got.click(); // force the retained listener even though the native button is disabled
    assert.deepEqual(evidenceOf(a), first); assert.deepEqual(a.actions, actions);
    assert.equal(a._knowledgeRevision, revision); assert.equal(a.answers, 1); assert.equal(a.saves, 1);
    const fresh = bindRecallFallback(a, surface, currentCode, key, question);
    fresh.reveal.click(); fresh.got.click(); // a legitimate fresh repeat retains local credit
    assert.deepEqual(a.prep, { [key]: 2, [shared]: 1 }); assert.equal(a._days.day, 1);
    assert.equal(a.stage[key][qh], 4); assert.equal(a.rec[key], 1);
    assert.deepEqual(a.srs[key][qh], [130, 30, 100]); assert.deepEqual(a.srs[shared][qh], [114, 14, 100]);
    assert.equal(a._qMod, -.08); assert.equal(a._combo, 4); assert.equal(a.answers, 2);
    assert.equal(Object.keys(a._knowledgeAttempts).length, 2);
    await Promise.resolve(); checked++;
  }
  assert.equal(checked, 4);
  console.log(`direct prior/current fallback callback scenarios: ${checked}; proof migration stage 2 -> 3, rec 0 -> 1`);
});

test("pure grading preserves prior recall arithmetic including repeats and shared scheduling", () => {
  const a = gradeHost(), b = gradeHost();
  for (const [name, fn] of Object.entries(old)) b[name] = fn;
  b._bumpStageVer = () => {};
  let evidence = K.ngKnowledgeBuildEvidence();
  const manifest = { decks: a.flashcards.decks, shared: a._sharedQ };
  let checked = 0;
  for (let i = 0; i < 14; i++) {
    const got = i % 5 !== 4;
    b.gradeRecall("A|Top", { q: "q" }, got);
    evidence = K.ngKnowledgeApplyGrade(evidence, { key: "A|Top", card: { q: "q" }, mode: "recall", correct: got, attemptId: String(i), dayKey: "day" }, manifest, 100).evidence;
    for (const [field, hostField] of [["prep", "prep"], ["stage", "stage"], ["rec", "rec"], ["srs", "srs"], ["sharp", "_sharp"], ["days", "_days"]]) {
      assert.deepEqual(evidence[field], b[hostField], `${field}, grade ${i}`); checked++;
    }
  }
  console.log(`captured prior recall evidence comparisons: ${checked}`);
});

test("all MC surfaces preserve prior grade arithmetic; valid repeats and trap/nontrap failures", () => {
  let checked = 0;
  const wrap = () => ({ querySelectorAll: () => Array.from({ length: 3 }, () => ({ style: {}, setAttribute() {} })) });
  for (const surface of ["deck", "land", "node", "jit", "panic"]) {
    const a = gradeHost(), b = gradeHost();
    for (const [name, fn] of Object.entries(old)) b[name] = fn;
    b._bumpStageVer = () => {};
    a.isTest = b.isTest = () => true;
    for (const pick of [2, 1, 0, 0, 0, 1, 0, 2, 0]) {
      const truth = { correct: 0, tiers: ["correct", "trap", "wrong"], surface, qhash: a.qhash("q") };
      a._mcAnswer(pick, { q: "q" }, "A|Top", wrap(), {}, null, { ...truth });
      b._mcAnswer(pick, { q: "q" }, "A|Top", wrap(), {}, null, { ...truth });
      for (const field of ["prep", "stage", "rec", "srs", "_sharp", "_days"]) {
        assert.deepEqual(a[field], b[field], `${surface}/${pick}/${field}`); checked++;
      }
    }
  }
  console.log(`captured prior MC evidence comparisons: ${checked}`);
});

test("transient event projection equals real landing answer and both expiry branches", () => {
  const make = () => {
    const h = { ...old, _qMod: -.02, _combo: 3, _landPending: true,
      _landQ: { answered: false, key: "A", card: { q: "q" } }, now: 10,
      _disarmLandClock() {}, _updateComboChip() {}, _comboPop() {}, refreshOptionOdds() {},
      comboName() { return "combo"; },
      _schedule() {}, setEvent() {}, fx() {}, _dockLandCard() {} };
    return h;
  };
  let checked = 0;
  for (const [correct, tier, format, type] of [[true, "correct", "mc", "mc-correct"], [true, "correct", "recall", "recall-correct"],
    [false, "wrong", "mc", "wrong"], [false, "trap", "mc", "wrong"], [false, "wrong", "recall", "wrong"]]) {
    const h = make();
    h._landAnswered(correct, tier, "land", null, format);
    const c = K.ngKnowledgeAdvance({ combo: 3, qMod: -.02, questionPending: true }, { type, tier });
    assert.equal(c.combo, h._combo); assert.equal(c.qMod, h._qMod); assert.equal(c.questionPending, h._landPending); checked++;
  }
  for (const surface of ["land", "panic"]) {
    const h = make();
    if (surface === "panic") {
      h._defendSub = 1; h._landEl = { hasAttribute: () => true, querySelector: () => null };
      h._panicFc = { pk: "A", fc: { q: "q" } };
    }
    h._expireLandQ();
    const c = K.ngKnowledgeAdvance({ combo: 3, qMod: -.02, questionPending: true }, { type: "expiry", surface });
    assert.equal(c.combo, h._combo); assert.equal(c.qMod, h._qMod); assert.equal(c.questionPending, h._landPending); checked++;
  }
  console.log(`captured prior transient branches: ${checked}`);
});

// EVERY CARD COUNTS (v1.221.0). The steps are the owner's: the app's `_landStep` (NG_LAND_ANSWER_STEPS in
// app.src.jsx) is pinned here card by card, so a change is a deliberate edit here too. Then the CURRENT app is
// driven card by card through one landing, stubbing only DOM callees. The landing question (k = 1) must still
// equal the shared law `ngKnowledgeAdvance` exactly — that law models k = 1 only, the MDP projects nothing
// further — and every later card adds only its own step and leaves momentum alone.
test("every card resolved in one landing steps the exchange again, down to a cap; a timeout never costs more than a wrong answer", () => {
  const app = Object.create(Component.prototype);
  const W = { correct: [0, .03, .02, .01, 0, 0], wrong: [-.04, -.03, -.02, -.01, 0, 0], trap: [-.08, -.06, -.04, -.02, 0, 0] };
  let steps = 0;
  for (const kind of Object.keys(W)) for (let k = 1; k <= 6; k++) { assert.equal(app._landStep(k, kind), W[kind][k - 1], `${kind} k=${k}`); steps++; }
  for (let k = 0; k <= 7; k++) assert.equal(app._landStep(k, "expiry"), app._landStep(k, "wrong"), `k=${k}: a timeout is the wrong step`);
  for (const k of [0, -1, 1.5, NaN]) assert.equal(app._landStep(k, "wrong"), 0, `k=${k} is no card`);
  for (let k = 2; k <= 6; k++) {
    for (const kind of ["wrong", "trap"]) assert.ok(Math.abs(app._landStep(k, kind)) <= Math.abs(app._landStep(k - 1, kind)), `${kind} k=${k} diminishes`);
    if (k > 2) assert.ok(app._landStep(k, "correct") <= app._landStep(k - 1, "correct"), `correct k=${k} diminishes`);
  }
  const host = () => {
    const h = Object.create(Component.prototype);
    Object.assign(h, { _qMod: -.02, _combo: 3, _landPending: true, _landResolved: 0, outcomes: [], beats: [], now: 10,
      _landQ: { answered: false, key: "A", card: { q: "q" } },
      _disarmLandClock() {}, _updateComboChip() {}, _comboPop() {}, refreshOptionOdds() {}, _schedule() {}, _dockLandCard() {},
      _outcome(o) { this.outcomes.push(o); }, fx(beat, p) { this.beats.push([beat, p]); } });
    return h;
  };
  // one resolution of card k, through the app's own grade path (the `done` closure's call) or its clock
  const resolve = (h, ev, k) => {
    h._landQ = { answered: false, key: "A", card: { q: "q" + k } };
    if (ev.type === "expiry") { h._landResolved = k - 1; h._expireLandQ(); return; }
    h._landAnswered(ev.type !== "wrong", ev.tier, "land", null, ev.type === "recall-correct" ? "recall" : undefined, k);
  };
  const kindOf = (ev) => ev.type === "wrong" ? (ev.tier === "trap" ? "trap" : "wrong") : ev.type === "expiry" ? "wrong" : "correct";
  const runs = [["mc-correct"], ["recall-correct"], ["wrong", "wrong"], ["wrong", "plausible"], ["wrong", "trap"], ["expiry"], ["mixed"]];
  let checked = 0;
  for (const [type, tier] of runs) {
    const h = host();
    let c = { combo: 3, qMod: -.02, questionPending: true };
    for (let k = 1; k <= 6; k++) {
      const ev = type === "mixed" ? [{ type: "wrong", tier: "trap" }, { type: "mc-correct" }, { type: "expiry" }, { type: "wrong", tier: "wrong" }][(k - 1) % 4] : { type, tier };
      const before = h.outcomes.length;
      resolve(h, ev, k);
      if (k === 1) c = K.ngKnowledgeAdvance(c, ev); // the landing question IS the shared law
      else { const st = W[kindOf(ev)][k - 1]; if (st) c = { ...c, qMod: c.qMod + st }; }
      assert.equal(h._qMod, c.qMod, `${type} k=${k}: qMod`); assert.equal(h._combo, c.combo, `${type} k=${k}: combo`);
      assert.equal(h.outcomes.length, before + 1, `${type} k=${k}: the card's outcome lands on the cards`);
      checked++;
    }
    const named = (b) => h.beats.filter(([x]) => x === b).length;
    if (type !== "expiry" && type !== "mixed") {
      assert.equal(named("land_q_answered"), 1, `${type}: one landing question per landing (challenge evidence)`);
      assert.deepEqual(h.beats.filter(([x]) => x === "land_q_extra").map(([, p]) => p.k), [2, 3, 4, 5, 6], `${type}: every later card is named with its k`);
    }
    if (type === "mc-correct") assert.equal(h._combo, 4, "momentum ticks once per landing, never per card");
  }
  // a timeout never costs more than a wrong answer on the same card: same pre-state, same k
  for (let k = 1; k <= 6; k++) {
    const w = host(), x = host();
    resolve(w, { type: "wrong", tier: "wrong" }, k); resolve(x, { type: "expiry" }, k);
    assert.ok(x._qMod >= w._qMod, `k=${k}: timeout qMod ${x._qMod} vs wrong ${w._qMod}`);
    assert.ok(x._combo >= w._combo, `k=${k}: timeout keeps at least the momentum a wrong answer keeps`);
    checked++;
  }
  console.log(`landing answer steps: ${steps} pinned, ${checked} app resolutions checked (k = 1 against ngKnowledgeAdvance)`);
});

test("MC growth-only cap, traps, reveal, SRS debt, shared manifest independence, attempt replay", () => {
  const q = { q: "q" }, h = K.ngKnowledgeQuestionHash(q.q);
  const manifest = { decks: { a: { n: 4 }, b: { n: 4 } }, shared: { [h]: ["a", "b"] } };
  const initial = K.ngKnowledgeBuildEvidence({ stage: { a: { [h]: 3 } }, srs: { a: { [h]: [2, 14, 1] } } });
  const ev = { key: "a", card: q, mode: "mc", correct: true, attemptId: "a" };
  const r = K.ngKnowledgeApplyGrade(initial, ev, manifest, 100);
  assert.equal(r.evidence.stage.a[h], 3); assert.equal(r.evidence.rec.a, undefined);
  assert.deepEqual(r.evidence.srs.a[h], [130, 30, 100]);
  assert.equal(initial.srs.a[h][0], 2, "due debt is not rewritten by snapshot construction");
  assert.equal(K.ngKnowledgeApplyGrade(r.evidence, ev, manifest, 100).status, "duplicate");
  const hydrated = { ...manifest, decks: { a: { cards: [q, q, q, q] }, b: { cards: [q, q, q, q] } } };
  assert.deepEqual(K.ngKnowledgeApplyGrade(initial, ev, hydrated, 100), r);
  const fail = K.ngKnowledgeApplyGrade(r.evidence, { ...ev, correct: false, tier: "trap", attemptId: "b" }, manifest, 100);
  assert.equal(fail.evidence.stage.a[h], 2); assert.equal(fail.evidence.prep.a, 1);
  assert.deepEqual(fail.evidence.srs.a[h], [101, 1, 100]);
  assert.equal(K.ngKnowledgeApplyGrade(initial, { ...ev, mode: "reveal" }, manifest, 100).evidence, initial);
  const repeat = K.ngKnowledgeApplyGrade(r.evidence, { ...ev, attemptId: "repeat" }, manifest, 100);
  assert.equal(repeat.evidence.prep.a, 2); assert.equal(repeat.evidence.prep.b, 1);
  assert.equal(repeat.evidence.sharp.b, undefined);
});

test("day rollover/ledger expiry and identity replacement cannot reuse stale personal counts", () => {
  const a = gradeHost(); let day = 200;
  a._epochDay = () => day;
  a.flow = { device: { a: { 1: [7, 4, 20], 2: [3, 2, 21] } } };
  assert.deepEqual(a.flowCounts(), { a: { 1: [7, 4], 2: [3, 2] } });
  const before = a.knowledgeProfile(); day++;
  assert.deepEqual(a.flowCounts(), { a: { 2: [3, 2] } });
  assert.ok(a.flow.device.a[1], "view expiry never deletes persisted counter");
  assert.notEqual(a.knowledgeProfile().fingerprint, before.fingerprint);
  a.flow = {}; assert.deepEqual(a.flowCounts(), {});
  a.prep = { a: 5 }; const p = a.knowledgeProfile(); a.prep = {};
  assert.notEqual(a.knowledgeProfile().fingerprint, p.fingerprint);
});
