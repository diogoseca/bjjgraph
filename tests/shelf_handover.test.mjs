// BGCLOSE-R1 (F4; the reader of PR #446): THIS VISIT'S SHELF OUTLIVES THE APP INSTANCE, AND STAYS ITS OWNER'S. Back and Forward
// mount a new app instance in the same document; the one leaving leaves its Last rolls shelf (`_leaveShelf`) and the next takes it
// at its boot (`_takeShelf`) only when it is the same owner's. A sign-in or a sign-out mounts another owner's instance, which takes
// nothing, as before (the host replaced the instance then too). The journey (map-press-closes-page.spec.ts, "Back after a close…")
// pins the handover and the reload by real presses; the owner half needs an owner change, so it is pinned here, on the app's own
// source. Mutant: `same = !!left` (the owner not asked) → red at "another owner takes nothing".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const read = (name) => readFileSync(new URL("../neural/src/" + name, import.meta.url), "utf8");
const progressOwner = read("progress-owner.src.js").replace(/^export (function|const|let|var|class) /gm, "$1 ");
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${progressOwner}\n${read("app.src.jsx")}\nreturn [Component, ngProgressOwner];`)(class {}, { createRef: () => ({ current: null }) });
const [App, owner] = Component;
const app = (who, rolls) => Object.assign(Object.create(App.prototype), { _progressOwner: who }, rolls ? { _pastRolls: rolls } : {});
const shelf = () => [{ ts: 2, outcome: "reset", log: [{ key: "X-Guard|Bottom" }, { key: "Mount|Top" }, { key: "Americana from Mount|Top" }] }, { ts: 1, outcome: "win", log: [{ key: "Mount|Top" }] }];

test("the same owner's next instance takes the shelf whole, in its order, once", () => {
  const rolls = shelf();
  app(owner(null), rolls)._leaveShelf();
  const next = app(owner(null));
  assert.equal(next._takeShelf(), true);
  assert.deepEqual(next._pastRolls, rolls, "the rolls, their states, their order");
  assert.notEqual(next._pastRolls[0].log, rolls[0].log, "a copy: the instance that left keeps nothing shared");
  const third = app(owner(null));
  assert.equal(third._takeShelf(), false, "taken once: the slot is empty after");
  assert.equal(third._pastRolls, undefined);
});

test("another owner takes nothing, and the shelf is not kept for a later instance either", () => {
  app(owner(null), shelf())._leaveShelf();
  const signedIn = app(owner("user-1"));
  assert.equal(signedIn._takeShelf(), false, "another owner takes nothing (a guest's shelf, an account's instance)");
  assert.equal(signedIn._pastRolls, undefined);
  assert.equal(app(owner(null))._takeShelf(), false, "and it is gone: the guest's next instance does not find it either");
  app(owner("user-1"), shelf())._leaveShelf();
  assert.equal(app(owner("user-2"))._takeShelf(), false, "another account takes nothing");
  app(owner("user-1"), shelf())._leaveShelf();
  assert.equal(app(owner(null))._takeShelf(), false, "a guest after an account (a sign-out) takes nothing");
  app(owner("user-1"), shelf())._leaveShelf();
  assert.equal(app(owner("user-1"))._takeShelf(), true, "the control: the same account takes it");
});

test("an empty shelf, or an instance with no owner, hands over nothing", () => {
  app(owner(null), [])._leaveShelf();
  assert.equal(app(owner(null))._takeShelf(), false);
  app(owner(null), shelf())._leaveShelf();
  assert.equal(app(undefined)._takeShelf(), false, "no owner: nothing is handed over, and nothing throws");
});
