// #354's review, round 7 (finding 2): a landing the background tap took away is kept only for the LIVE decision it belongs to.
// After a commit `_decision` is null through the flight and endRound's hold, and a dismissal made then would record null too:
// `null === null` matched, so a later Video or Questions press restored a finished roll's landing (and its film) in free roam.
// Not reproducible by mouse on v1.253.0's build (the commit clears the card at once, so the tap goes straight to roam), so the
// predicate itself is pinned here, built from the app's own source. Mutant `land-away-null-decision` (the `!!d.decision &&` guard
// removed) turns "a dismissal with no live decision is never away" red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const appSource = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${appSource}\nreturn Component;`)(class {}, { createRef: () => ({ current: null }) });

const app = (fields) => Object.assign(Object.create(Component.prototype), { _landEl: null, currentPos: 7 }, fields);

test("a dismissal with no live decision is never away, even when the app's decision is null too", () => {
  const a = app({ _decision: null, _landDismissed: { idx: 3, mode: "land", pos: 7, decision: null } });
  assert.equal(a._landAway(), false);
  assert.equal(a.restoreLanding(), false, "and nothing is restored");
  assert.equal(a._landIdx, undefined, "the finished roll's landing is not put back");
});

test("a dismissal for the live decision is away until the decision, the position or the card moves on", () => {
  const decision = {}, d = { idx: 3, mode: "land", pos: 7, decision };
  assert.equal(app({ _decision: decision, _landDismissed: d })._landAway(), true, "the control: the same live decision");
  assert.equal(app({ _decision: {}, _landDismissed: d })._landAway(), false, "a new decision");
  assert.equal(app({ _decision: decision, _landDismissed: d, currentPos: 8 })._landAway(), false, "another position");
  assert.equal(app({ _decision: decision, _landDismissed: d, _landEl: {} })._landAway(), false, "a card is up");
});
