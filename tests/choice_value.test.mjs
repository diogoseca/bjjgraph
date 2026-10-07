// These fixtures verify the consumer, not the full-game model or live-law parity.
// The independently owned solver and browser journeys supply those other boundaries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NG_CHOICE_VALUE, ngChoiceValueController, ngChoiceValueStamp, ngChoiceValuePercent,
  ngChoiceValueView, ngChoiceValueHTML, ngChoiceValueOrder, ngChoiceValueKnowledge,
  ngChoiceValueThreatView, ngChoiceValueThreatOrder, ngChoiceValueImmediate, ngChoiceValueUpdating, NG_CHOICE_VALUE_RUNTIME,
} from "../neural/src/choice-value.src.js";

const action = name => JSON.stringify(["mount/top", name, "transition", "back/top", "branch"]);
const A = action("arm-drag"), B = action("pass");
function request(extra = {}) {
  return { ...NG_CHOICE_VALUE, requestId: "r1", revision: 1, contractHash: "contract-1",
    modelHash: "model", mechanicsHash: "mechanics", graphHash: "graph", profileHash: "profile",
    opponentPolicyHash: "opponent", ruleset: "nogi", state: { id: "mount/top", role: "top", phase: "decision" },
    horizon: { kind: "actual-roll", episodeCap: 10, moveCount: 3 }, requestedActionIds: [A, B], ...extra };
}
function record(id, win, loss = .2, extra = {}) {
  return { actionId: id, stateId: "mount/top", policyId: "policy", status: "ready",
    immediateExecutionChance: .8, immediateExecutionKind: "transition",
    outcomes: { win, loss, explicitNoResult: 1 - win - loss, nontermination: 0 }, ...extra };
}
function response(req, rows = [record(A, .6), record(B, .4)]) {
  return { ...req, root: { ...rows[0], selectedActionId: rows[0].actionId }, actions: rows,
    quality: { numericalStatus: "exact-rational", maxWinError: 0, policyRegretBound: 0, actionCoverage: 2, supportHash: "support", unresolvedReasons: [] } };
}
function certify(r, error = .0001) {
  for (const row of [...r.actions, r.root]) {
    row.status = "bounded";
    row.secondaryStatus = "unresolved-primary-ties";
    row.outcomeBounds = Object.fromEntries(Object.entries(row.outcomes).map(([k,v]) => [k,[Math.max(0,v-error),Math.min(1,v+error)]]));
    row.winBounds = row.outcomeBounds.win;
  }
  r.quality = { numericalStatus: "certified", maxWinError: error, coordinateErrorBound: error, policyRegretBound: error, secondaryStatus: "unresolved-primary-ties", tertiaryStatus: "unresolved-primary-loss-ties" };
  r.diagnostics = { certificate: "exact-rational-all-action-drift+common-policy-residual+Bellman-supersolution" };
  return r;
}
function ready(rows, req = request()) {
  const controller = ngChoiceValueController(), token = controller.begin(req, { handId: "h1" });
  assert.ok(controller.accept(token, response(req, rows)));
  return controller.snapshot();
}

test("headline is future win; immediate execution, loss, reset and infinite play remain distinct", () => {
  const a = record(A, .3, .2, { immediateExecutionChance: .9, outcomes: { win: .3, loss: .2, explicitNoResult: .4, nontermination: .1 } });
  const snapshot = ready([a, record(B, .6)]), view = ngChoiceValueView(snapshot.actions[0], snapshot);
  assert.equal(view.value, "30%"); assert.equal(view.immediate, "90%");
  assert.deepEqual(view.outcomes, [{ label: "Win", value: "30%" }, { label: "Loss", value: "20%" }, { label: "No result", value: "50%" }]);
  assert.match(view.notes.join(" "), /40% game reset; 10% play that never ends/);
  assert.match(view.notes.join(" "), /counter 3 \/ 10/);
  assert.match(view.detail, /current practice/);
});

test("true zero is zero; missing, invalid and tiny positive probabilities never masquerade as zero", () => {
  assert.equal(ngChoiceValuePercent(0), "0%"); assert.equal(ngChoiceValuePercent(1), "100%");
  assert.equal(ngChoiceValuePercent(.00001), "<1%"); assert.equal(ngChoiceValuePercent(.99999), ">99%");
  for (const bad of [null, undefined, NaN, Infinity, -1, 1.01, "0.5", false]) assert.equal(ngChoiceValuePercent(bad), "—");
  assert.equal(ngChoiceValueView().value, "—");
  assert.match(ngChoiceValueView().detail, /unavailable for this roll/);
});

test("bounds crossing a rounding threshold stay a range; point values require valid bounds", () => {
  assert.equal(ngChoiceValuePercent(.424, [.42, .4249]), "42%");
  assert.equal(ngChoiceValuePercent(.425, [.424, .426]), "42–43%");
  for (const bad of [[.5, .4], [null, .4], [0], [0, 2]]) assert.equal(ngChoiceValuePercent(.4, bad), "—");
  const rows = [record(A, .425, .2, { status: "bounded", winBounds: [.42, .43] }), record(B, .3)];
  const req = request(), c = ngChoiceValueController(), token = c.begin(req, { handId: "bounded" });
  c.accept(token, certify(response(req, rows)));
  const s = c.snapshot();
  assert.equal(ngChoiceValueView(s.actions[0], s).value, "42–43%");
  assert.deepEqual(ngChoiceValueOrder([B, A], s), [B, A], "an ambiguous result cannot rank the hand");
});

test("reported conversion error is honored at rounding boundaries", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" });
  const r = response(req, [record(A, .425), record(B, .3)]);
  certify(r);
  c.accept(t, r);
  assert.equal(ngChoiceValueView(c.snapshot().actions[0], c.snapshot()).value, "42–43%");
});

test("each action's normalized four-vector belongs to the single selected policy", () => {
  for (const change of [
    r => { r.policyId = "another-policy"; },
    r => { r.stateId = "another-seat"; },
    r => { r.outcomes.loss = .9; },
    r => { r.outcomes.loss = null; },
    r => { r.outcomes.nontermination = -.1; },
    r => { r.immediateExecutionChance = NaN; },
    r => { r.status = "bounded"; },
  ]) {
    const rows = [record(A, .6), record(B, .4)]; change(rows[1]);
    const s = ready(rows);
    assert.equal(s.actions[1].status, "unavailable"); assert.equal(s.actions[1].outcomes, undefined);
  }
});

test("missing and incomplete solver coverage cannot become a loss/no-result component", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" });
  c.accept(t, response(req, [record(A, .6)]));
  assert.equal(c.snapshot().actions[1].reason, "missing-action");
  assert.equal(c.snapshot().actions[1].outcomes, undefined);
  const incomplete = response(req); incomplete.quality.numericalStatus = "incomplete";
  c.accept(t, incomplete);
  assert.equal(c.snapshot().actions[0].reason, "incomplete");
  assert.equal(ngChoiceValueView(c.snapshot().actions[0]).value, "—");
});

test("pending cards remain explicit and can carry the separately known immediate chance", () => {
  const c = ngChoiceValueController(); c.begin(request(), { handId: "h", immediate: { [A]: { immediateExecutionChance: .75 } } });
  const v = ngChoiceValueView(c.snapshot().actions[0]);
  assert.equal(v.state, "Calculating…"); assert.equal(v.value, "—"); assert.equal(v.immediate, "75%");
  assert.match(v.detail, /can choose a move now/);
});

// THE ENTRY CARD (owner, 2026-10-01: "every submission from the position have 100% chance"). Stepping
// into a submission is certain; the card prints the FOLLOW-UP finish the engine reports, as "Works",
// and never the step's own 100%. No follow-up (pending, or one that does not reconcile) is "Works —".
const followUp = (chance, extra = {}) => ({ kind: "finish", chance, explanation: { status: "ready", chance, ...extra } });
test("an entry prints its follow-up finish as Works, never the certain step's 100%", () => {
  const entry = (extra) => record(A, .3, .2, { immediateExecutionKind: "entry", immediateExecutionChance: 1, ...extra });
  const bare = ngChoiceValueView(entry());
  assert.equal(bare.immediateLabel, "Works"); assert.equal(bare.immediate, "—"); assert.equal(bare.immediateText, "Works —");
  assert.equal(bare.value, "30%");
  const v = ngChoiceValueView(entry({ followUp: followUp(.45) }));
  assert.equal(v.immediate, "45%"); assert.equal(v.immediateText, "Works 45%");
  assert.match(v.immediateLine, /^Works 45%: the finish's chance once you are in\. Stepping in is certain/);
  assert.equal(ngChoiceValueView(record(A, .3, .2, { immediateExecutionKind: "enter", immediateExecutionChance: 1, followUp: followUp(.6) })).immediateText, "Works 60%", "an entry from a submission state reads the same");
  assert.equal(ngChoiceValueView(entry({ followUp: { ...followUp(.45), explanation: { status: "ready", chance: .5 } } })).immediate, "—", "a follow-up that does not reconcile is dropped");
  assert.equal(ngChoiceValueView(entry({ followUp: { ...followUp(.45), kind: "transition" } })).immediate, "—");
  for (const view of [bare, v]) assert.doesNotMatch([view.immediate, view.immediateText, view.immediateLine].join(" "), /100%/);
  assert.equal(ngChoiceValueView(record(B, .6, .2, { immediateExecutionKind: "escape" })).immediateLabel, "Escape");
  assert.equal(ngChoiceValueView(record(B, .6, .2, { immediateExecutionKind: "finish" })).immediateText, "Finish chance 80%");
  // through the controller: a reconciling follow-up survives into the snapshot, a broken one is null
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h", immediate: { [A]: { immediateExecutionKind: "entry", immediateExecutionChance: 1 } } });
  assert.equal(ngChoiceValueView(c.snapshot().actions[0]).immediateText, "Works —", "pending entry");
  assert.ok(c.accept(t, response(req, [record(A, .6, .2, { immediateExecutionKind: "entry", immediateExecutionChance: 1, followUp: followUp(.58) }),
    record(B, .4, .2, { immediateExecutionKind: "entry", immediateExecutionChance: 1, followUp: followUp(1.2) })])));
  const snap = c.snapshot();
  assert.equal(snap.actions[0].followUp.chance, .58); assert.equal(snap.actions[1].followUp, null);
  assert.equal(ngChoiceValueView(snap.actions[0], snap).immediateText, "Works 58%");
  assert.equal(ngChoiceValueView(snap.actions[1], snap).value, "40%", "a dropped follow-up never hides the Win chance");
});

test("exact stamped identity is required, including ruleset, personal profile, horizon and policy", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" });
  for (const key of ["apiVersion", "requestId", "revision", "contractHash", "modelHash", "mechanicsHash", "graphHash", "profileHash", "opponentPolicyHash", "ruleset", "objective", "horizon", "futureStudyPolicy"]) {
    const bad = response(req); bad[key] = "different";
    assert.equal(c.accept(t, bad), false, key);
    assert.equal(c.snapshot().status, "pending");
  }
  assert.equal(c.accept(t, response(req)), true);
});

test("a live context change invalidates the reply even before its next refresh is queued", () => {
  let current = true;
  const c = ngChoiceValueController({ isCurrent: () => current }), req = request(), t = c.begin(req, { handId: "h" });
  current = false;
  assert.equal(c.accept(t, response(req)), false);
  assert.equal(c.fail(t), false);
  assert.equal(c.snapshot().status, "pending");
});

test("cancellation, supersession, changed hand and unmount reject late replies and failures", () => {
  const canceled = [], emitted = [];
  const c = ngChoiceValueController({ cancel: r => canceled.push(r), publish: s => emitted.push(s) }), req = request();
  const first = c.begin(req, { handId: "h1" }), second = c.begin(req, { handId: "h2" });
  assert.notEqual(first, second); assert.equal(c.accept(first, response(req)), false); assert.equal(c.fail(first), false);
  assert.equal(c.accept(second, response(req)), true);
  c.cancel("commit"); assert.equal(c.accept(second, response(req)), false); assert.equal(c.snapshot(), null);
  const third = c.begin(request({ requestId: "r2", revision: 2 }), { handId: "h3" });
  c.destroy(); const count = emitted.length;
  assert.equal(c.accept(third, response(third.request)), false); assert.equal(c.begin(req, { handId: "h4" }), null);
  assert.equal(emitted.length, count); assert.deepEqual(canceled, ["superseded", "commit", "destroyed"]);
});

test("snapshots copy and deeply freeze caller-owned request, outcomes and explanation", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" });
  req.state.role = "bottom"; assert.equal(t.request.state.role, "top");
  const r = response(t.request); c.accept(t, r);
  r.actions[0].outcomes.win = .9;
  assert.equal(c.snapshot().actions[0].outcomes.win, .6);
  assert.throws(() => { c.snapshot().actions[0].outcomes.win = .7; }, TypeError);
});

test("same stamped refresh deduplicates but a changed phase or cap-check state is distinct", () => {
  const c = ngChoiceValueController(), req = request(), a = c.begin(req, { handId: "h" });
  assert.equal(c.begin(structuredClone(req), { handId: "h" }), a);
  req.state.phase = "over-cap-response";
  assert.notEqual(c.begin(req, { handId: "h" }), a);
  assert.ok(ngChoiceValueStamp(request({ horizon: { kind: "actual-roll", episodeCap: 10, moveCount: 11 } })), "over-cap live opportunities are not uniformly discarded");
});

test("eventual values, missing context and duplicate composite identities are refused", () => {
  assert.equal(ngChoiceValueStamp(request({ horizon: { kind: "eventual" } })), null);
  assert.equal(ngChoiceValueStamp(request({ state: { role: "top" } })), null);
  assert.equal(ngChoiceValueStamp(request({ requestedActionIds: [A, A] })), null);
  const c = ngChoiceValueController(); c.begin(request({ horizon: { kind: "eventual" } }), { handId: "h" });
  assert.equal(c.snapshot().reason, "unsupported-horizon");
});

test("explicit ordering compares visible rounded win bins with canonical content ties", () => {
  const req = request(), rows = [record(A, .601), record(B, .604)];
  const s = ready(rows, req);
  assert.deepEqual(ngChoiceValueOrder([B, A], s), [A, B]);
  assert.match(ngChoiceValueView(s.actions[0], s).notes.join(" "), /does not make their exact values equal/);
  assert.deepEqual(ngChoiceValueOrder([B, "missing", A], s), [B, "missing", A]);
  assert.deepEqual(ngChoiceValueOrder([A, B], ready([record(A, .3), record(B, .6)])), [B, A]);
});

test("ties do not imply every counterfactual action is a safe stationary policy", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" });
  const rows = [record(A, .6, .2, { rank: 1 }), record(B, .6, .2, { rank: 2 })];
  const r = response(req, rows); r.root = { ...rows[1], selectedActionId: B };
  c.accept(t, r); const s = c.snapshot();
  assert.equal(ngChoiceValueView(s.actions[0], s).recommended, false);
  assert.equal(ngChoiceValueView(s.actions[1], s).recommended, true);
  assert.match(ngChoiceValueView(s.actions[1], s).notes.join(" "), /recommended future play starts with this move/);
  assert.deepEqual(ngChoiceValueOrder([A, B], s), [B, A], "selectedActionId governs recommendation, not rank or lexical order");
});

test("sorting and tie prose distinguish exact endpoints from tiny nonzero probabilities", () => {
  for (const [low, high] of [[0, .001], [.999, 1], [.001, .01], [.99, .999]]) {
    const s = ready([record(A, low, 0), record(B, high, 0)]);
    assert.deepEqual(ngChoiceValueOrder([A, B], s), [B, A]);
    assert.doesNotMatch(ngChoiceValueView(s.actions[0], s).notes.join(" "), /choices round to the same/);
  }
});

test("cross-state roots and mismatched selected outcomes remain unavailable", () => {
  for (const change of [r => { r.root.stateId = "other-state"; }, r => { r.root.outcomes = { win: .5, loss: .5, explicitNoResult: 0, nontermination: 0 }; }]) {
    const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h" }), r = response(req);
    change(r); c.accept(t, r);
    assert.equal(c.snapshot().actions[0].status, "unavailable");
    assert.equal(c.snapshot().actions[0].outcomes, undefined);
  }
});

test("a failed solve exposes an actionable error without a fabricated outcome", () => {
  const c = ngChoiceValueController(), t = c.begin(request(), { handId: "h" });
  assert.equal(c.fail(t), true);
  const v = ngChoiceValueView(c.snapshot().actions[0]);
  assert.equal(v.state, "Could not calculate"); assert.equal(v.value, "—");
  assert.equal(v.outcomes.length, 0); assert.match(v.detail, /still choose this move/);
});

test("knowledge inputs and same-context immediate comparisons never become forward win lift", () => {
  const explanation = { chance: .95, knowledge: { status: "applied", components: [
    { deckKey: "Mount|Top", role: "Top", source: "practice", bonus: .15 },
    { deckKey: "Armbar|Attacker", role: "Attacker", source: "sharpness", bonus: .1 },
  ] }, comparison: { kind: "same-context-no-knowledge", chance: .8, effectiveDelta: .15 }, clamp: { applied: true } };
  const k = ngChoiceValueKnowledge(explanation), text = k.lines.join(" ");
  assert.match(text, /\+15 pp input/); assert.match(text, /\+10 pp input/);
  assert.match(text, /95% with practice; 80% without practice/);
  assert.match(text, /do not simply add/); assert.doesNotMatch(text, /win|25%/);
  assert.match(ngChoiceValueKnowledge({ knowledge: { status: "bypassed" } }).lines.join(" "), /override replaces/);
  assert.match(text, /Recent study/); assert.doesNotMatch(text, /Recent recall/);
  const entry = ngChoiceValueKnowledge(explanation, "entry").lines.join(" ");
  assert.match(entry, /Finish chance once you are in: 95% with practice; 80% without practice/);
  assert.match(entry, /Stepping into the submission is certain\. The finish is rolled once you are in/);
  assert.doesNotMatch(entry, /Immediate chance|at these conditions|100%/);
  explanation.comparison.effectiveDelta = .25;
  assert.doesNotMatch(ngChoiceValueKnowledge(explanation).lines.join(" "), /without practice/);
});

test("empty player profile differs from unknown defense deck knowledge", () => {
  assert.equal(ngChoiceValueKnowledge({ knowledge: { status: "applied", components: [] } }).summary, "No practice bonus yet");
  assert.equal(ngChoiceValueKnowledge({ knowledge: { status: "unavailable" } }).summary, "Practice effect unavailable");
});

test("delayed opportunity prose requires actual matching policy/contract evidence", () => {
  const req = request(), r = record(A, .6);
  r.explanation = { opportunities: [{ kind: "delayed-win", policyId: "policy", contractHash: "contract-1", stateId: "back/top", label: "Back control", probability: .3 }] };
  const s = ready([r, record(B, .4)], req);
  assert.match(ngChoiceValueView(s.actions[0], s).notes.join(" "), /Later opportunity: Back control \(30%/);
  for (const key of ["policyId", "contractHash"]) {
    r.explanation.opportunities[0][key] = "stale";
    assert.doesNotMatch(ngChoiceValueView(r, s).notes.join(" "), /Later opportunity/);
  }
  assert.doesNotMatch(ngChoiceValueView(record(A, .6)).notes.join(" "), /Later opportunity/);
});

test("renderer escapes authored/profile labels and has a text label for every outcome", () => {
  const view = ngChoiceValueView(record(A, .6));
  view.knowledge.lines = ['<img src=x onerror="alert(1)">'];
  const html = ngChoiceValueHTML(view, true);
  assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/);
  for (const label of ["Win chance", "Win", "Loss", "No result"]) assert.ok(html.includes(label));
});

test("the real app's first card can render with no value-module globals at all", () => {
  const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
  // Function runs outside this module's imports: no ngChoiceValue or namespace binding
  // exists there. This catches early references that an eager browser bundle would hide.
  const Component = new Function("DCLogic", "React", source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
  const a = new Component({}); a.choiceChance = () => .001;
  assert.equal(a.choiceValueRuntime(), null);
  const opt = { node: { ty: "transitions" } }, view = a.choiceValueView(opt);
  assert.equal(view.value, "—"); assert.equal(view.immediate, "<1%");
  assert.match(a.choiceValueHTML(view, true), /still choose this move/);
  const entry = a.choiceValueView({ action: "enter", node: { ty: "submissions" } });
  assert.equal(entry.immediateLabel, "Works"); assert.equal(entry.immediate, "—");
  assert.doesNotMatch(a.choiceValueHTML(entry, true), /100%/);
  // The app's pre-load copy of the small line and the module's own say the same words for every kind
  // and chance: two bundles, one sentence. An entry never prints its certain step.
  let compared = 0;
  for (const kind of ["entry", "enter", "finish", "escape", "transition"]) for (const p of [1, .997, .58, .001, 0, NaN]) {
    assert.deepEqual(a.choiceImmediateFallback(kind, p), ngChoiceValueImmediate(kind, p, null), kind + " " + p); compared++;
  }
  assert.equal(compared, 30);
  a.setChoiceValueRuntime(null, "loading");
  assert.equal(a.choiceValueView(opt).status, "pending");
  a.setChoiceValueRuntime({}, "loading");
  assert.equal(a.choiceValueView(opt).status, "error");
});

// THE TOOLTIP (owner, 2026-09-29): the engine's landed/missed regrouping is shown only when it adds
// back up to the card's own total; an inconsistent split is dropped, never displayed.
test("a reconciling split becomes the plain-words tooltip; an inconsistent one is dropped", () => {
  const good = record(A, .6, .2, { split: { lands: .8, winIfLands: .7, winIfMisses: .2 } });  // .8*.7+.2*.2 = .6
  const bad = record(B, .4, .2, { split: { lands: .5, winIfLands: .9, winIfMisses: .9 } });   // .9 != .4
  const s = ready([good, bad]);
  const a = s.actions.find(r => r.actionId === A), b = s.actions.find(r => r.actionId === B);
  assert.deepEqual(a.split, { lands: .8, winIfLands: .7, winIfMisses: .2 });
  assert.equal(b.split, null, "a split that does not reconcile is never shown");
  const v = ngChoiceValueView(a, s);
  assert.deepEqual(v.split, [
    "The move lands (80%): then you win 70%.",
    "The move misses (20%): then you win 20%.",
    "80% × 70% + 20% × 20% ≈ 60% win chance.",
    "You get submitted 20% · nobody taps 20%.",
  ]);
  assert.match(v.tooltip, /^Win chance 60%\n/);
  assert.match(ngChoiceValueHTML(v, true), /data-choice-split/);
  assert.equal(ngChoiceValueView(b, s).tooltip, undefined);
});

test("escape and entry wording name the two cases the player actually faces", () => {
  const esc = record(A, .3, .7, { immediateExecutionKind: "escape", split: { lands: .3, winIfLands: 1, winIfMisses: 0 } });
  const entry = record(B, .5, .3, { immediateExecutionKind: "entry", split: { lands: 1, winIfLands: .5, winIfMisses: null } });
  const s = ready([esc, entry]);
  const ve = ngChoiceValueView(s.actions.find(r => r.actionId === A), s), vn = ngChoiceValueView(s.actions.find(r => r.actionId === B), s);
  assert.equal(ve.split[0], "The escape works (30%): you win.");
  assert.equal(ve.split[1], "The escape fails (70%): you are submitted.");
  assert.deepEqual(vn.split, ["You step into the submission: certain, no roll.",
    "From there, your win chance with your best play is 50%.", "You get submitted 30% · nobody taps 20%."],
    "no misses line, no sum, and no \"(100%)\" for a certain step");
  const withFinish = ready([record(B, .5, .3, { immediateExecutionKind: "entry", immediateExecutionChance: 1, followUp: followUp(.45), split: { lands: 1, winIfLands: .5, winIfMisses: null } })], request({ requestedActionIds: [B] }));
  const vf = ngChoiceValueView(withFinish.actions[0], withFinish);
  assert.equal(vf.split[1], "Then the finish works 45% when you go for it.");
  assert.doesNotMatch(vf.tooltip, /100%/);
});

// SORT ONCE (owner, 2026-09-29): bounded values sort when their bins are distinct (certified ties: choice_certified.test.mjs).
test("bounded values with distinct bins sort by win chance", () => {
  const s = ready(certify(response(request(), [record(B, .4), record(A, .6)])).actions, request());
  assert.deepEqual(ngChoiceValueOrder([B, A], s), [A, B]);
});

// THREAT CARDS (owner, 2026-09-29): YOUR win chance if the opponent tries that move, held to the
// same bar as a card, sorted most dangerous first.
test("threat records are validated like cards, viewed as your win chance, and sorted most dangerous first", () => {
  const req = request({ threatIds: ["T-escape", "T-sweep", "T-alien"] });
  const controller = ngChoiceValueController(), token = controller.begin(req, { handId: "h1" });
  const threat = (id, win, extra = {}) => ({ techniqueId: id, stateId: "mount/top", policyId: "policy", status: "ready",
    outcomes: { win, loss: 1 - win - .1, explicitNoResult: .1, nontermination: 0 }, ...extra });
  const res = response(req);
  res.threats = [threat("T-escape", .64), threat("T-sweep", .31), threat("T-alien", .5, { policyId: "other-policy" })];
  assert.ok(controller.accept(token, res));
  const snap = controller.snapshot();
  assert.deepEqual(snap.threats.map(t => [t.techniqueId, t.status]), [["T-escape", "ready"], ["T-sweep", "ready"], ["T-alien", "unavailable"]]);
  assert.equal(snap.threats[2].reason, "invalid-result", "a threat under another policy is never shown");
  const v = ngChoiceValueThreatView(snap.threats[1], snap);
  assert.equal(v.value, "31%");
  assert.equal(v.tooltip, "If they try this, you win 31% (you get submitted 59%, nobody taps 10%), with your best play from there.");
  assert.equal(ngChoiceValueThreatView(snap.threats[2], snap).value, "—");
  assert.deepEqual(ngChoiceValueThreatOrder(["T-escape", "T-sweep"], snap), ["T-sweep", "T-escape"]);
  assert.deepEqual(ngChoiceValueThreatOrder(["T-escape", "T-sweep", "T-alien"], snap), ["T-escape", "T-sweep", "T-alien"], "an unvalued threat keeps the dealt order");
});

test("Inspect renders the app's pre-values view (runtime loaded, values still preparing) without throwing", () => {
  // The app builds this short view itself while the model prepares (app.src.jsx choiceValueView)
  // and still hands it to this renderer: no outcomes, knowledge or notes. Found by
  // announcer-coherence / option-edge on the first full-suite run of the full game.
  const view = { label: "Win chance", value: "—", status: "pending", state: "Preparing…", recommended: false,
    detail: "Preparing win chances. You can choose a move now.", immediate: "38%", immediateLabel: "Move" };
  const html = ngChoiceValueHTML(view, true);
  assert.match(html, /data-choice-win>—</);
  assert.match(html, /Move chance now: 38%/);
  assert.doesNotMatch(html, /ngcv-outcomes|undefined/);
});

// THE LAST NUMBER STAYS WHILE THE SAME HAND RE-SOLVES (WINLAT1). The host pairs a card's pending view
// with the last READY view that same card showed in the same hand; this is the merge it paints.
test("a re-solving card keeps its last Win chance, dimmed and named as updating; nothing else is borrowed", () => {
  const req = request(), c = ngChoiceValueController(), t = c.begin(req, { handId: "h", immediate: {} });
  assert.ok(c.accept(t, response(req, [record(A, .62), record(B, .38)])));
  const ready = ngChoiceValueView(c.snapshot().actions[0], c.snapshot());
  assert.equal(ready.value, "62%");
  // the answer: same hand, a new request, pending, with the NEW immediate chance
  c.begin(request({ requestId: "r2", revision: 2, profileHash: "profile-2" }), { handId: "h", immediate: { [A]: { immediateExecutionChance: .85 } } });
  const pending = ngChoiceValueView(c.snapshot().actions[0], c.snapshot());
  assert.equal(pending.value, "—"); assert.equal(pending.status, "pending");
  const shown = ngChoiceValueUpdating(pending, ready);
  assert.equal(shown.value, "62%", "the previous Win chance stays visible");
  assert.equal(shown.stale, true); assert.equal(shown.state, "Updating…"); assert.equal(shown.status, "pending", "still pending: no sort, legend or badge reads it as current");
  assert.equal(shown.recommended, false); assert.equal(shown.immediate, "85%", "the move chance is the new one");
  assert.deepEqual(shown.outcomes, []); assert.equal(shown.split, null);
  // the stale number also SAYS it is updating (v1.220.0, #267 review): aria-label, and "62%…" by CSS
  assert.match(ngChoiceValueHTML(shown), /<strong data-choice-win data-choice-stale aria-label="Win chance 62%, updating">62%<\/strong>/);
  assert.doesNotMatch(ngChoiceValueHTML(ready), /data-choice-stale/);
  assert.match(ngChoiceValueHTML(shown, true), /Updating…/);
  // nothing to keep: no previous, a previous that was not a value, or a current view that is not pending
  assert.equal(ngChoiceValueUpdating(pending, undefined), pending);
  assert.equal(ngChoiceValueUpdating(pending, pending), pending);
  assert.equal(ngChoiceValueUpdating(ready, ready), ready, "a ready view is shown as itself");
  const failed = { ...pending, status: "unavailable" };
  assert.equal(ngChoiceValueUpdating(failed, ready), failed, "a failure never borrows the old number");
  assert.equal(NG_CHOICE_VALUE_RUNTIME.ngChoiceValueUpdating, ngChoiceValueUpdating, "the lazily loaded runtime exports it");
});
test("a re-solving entry card keeps its last Works number too, dimmed; a known one is never replaced", () => {
  const entry = { immediateExecutionKind: "entry", immediateExecutionChance: 1 };
  const ready = ngChoiceValueView(record(A, .3, .2, { ...entry, followUp: followUp(.45) }));
  const pending = ngChoiceValueView({ actionId: A, status: "pending", reason: "pending", ...entry });
  assert.equal(pending.immediate, "—");
  const shown = ngChoiceValueUpdating(pending, ready);
  assert.equal(shown.immediate, "45%"); assert.equal(shown.immediateStale, true); assert.equal(shown.immediateText, "Works 45%");
  const transition = ngChoiceValueUpdating(ngChoiceValueView({ actionId: B, status: "pending", reason: "pending", immediateExecutionKind: "transition", immediateExecutionChance: .7 }), ngChoiceValueView(record(B, .4)));
  assert.equal(transition.immediate, "70%"); assert.equal(transition.immediateStale, undefined);
});
