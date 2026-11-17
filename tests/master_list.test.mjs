// Master the game's list (L1, v1.290.0): neural/src/master-list.src.js, pure. The rows, their order, their words and the
// button's words; the page that paints them is pinned by e2e/journeys/master-list.spec.ts.
//
// MUTANTS (each applied alone to master-list.src.js, red on the named test; the clean file green before and after):
//   L1-1 the plan's rows sorted by name instead of the plan's order          → "the plan's rows keep the plan's own order"
//   L1-2 a been-to place with nothing due dropped                            → "every other place you have been to is a row, with nothing due"
//   L1-3 an explored key that no longer resolves dropped without a count     → "a key that no longer resolves is counted, never shown"
//   L1-4 a row's number is the marks drawn (at most 8), not the gold count   → "a row's number is the gold count, its marks at most eight"
//   L1-5 "Continue" before the day's first answer                            → "the button's words"
//   L1-6 the button names the second place                                   → the page's own: L1-A1 in e2e/journeys/master-list.spec.ts
//   L1-7 a place the plan visits you never stood on is not marked new        → "a place you never stood on is marked new"
// L1-R1 (the reader of PR #434, its findings 1 and 3):
//   L1-8 a place's debt not read (every place outside the plan "nothing due") → "a place that owes cards is never called nothing due…"
//   L1-9 nothing left before the goal opens a finished place, not Keep practising → "the button's words"
// L1-R2 (the second reader of PR #434):
//   L1-11 a place that owes, in neither the record nor the plan, has no row → "every place that owes cards has a row…"
//   L1-10 (progress-owner.src.js) a damaged `explored` entry refuses the record again → "a damaged explored is read as its strings…"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ngMasterRows, ngMasterStart, ngMasterWhen } from "../neural/src/master-list.src.js";
import { ngProgressExploredKeys, ngProgressValidateBlob } from "../neural/src/progress-owner.src.js";

const DAY = 20400;
const P = (k) => { const [name, side] = k.split("|"); return { name, side, pos: side === "Top" || side === "Bottom" }; };
const resolve = (k) => (k.startsWith("Gone") ? null : k.startsWith("Hidden") ? false : P(k));

test("the plan's rows keep the plan's own order", () => {
  const plan = [{ seat: "Side Control|Bottom", due: 3 }, { seat: "Mount|Bottom", due: 6 }, { seat: "Back Control|Top", due: 1 }];
  const v = ngMasterRows({ plan, explored: plan.map((p) => p.seat), resolve, day: DAY });
  assert.deepEqual(v.rows.map((r) => r.seat), ["Side Control|Bottom", "Mount|Bottom", "Back Control|Top"]);
  assert.deepEqual(v.rows.map((r) => r.visit), [0, 1, 2]);
  assert.deepEqual(v.rows.map((r) => r.sub), ["3 due", "6 due", "1 due"]);
});

test("every other place you have been to is a row, with nothing due", () => {
  const v = ngMasterRows({ plan: [{ seat: "Mount|Bottom", due: 2 }], explored: ["Mount|Bottom", "Combat Base|Bottom", "Back Control|Bottom"], resolve, day: DAY,
    lastDay: (k) => (k === "Back Control|Bottom" ? { day: DAY - 1, kind: "played" } : null), owed: () => 0 });
  assert.deepEqual(v.rest.map((r) => r.seat), ["Back Control|Bottom", "Combat Base|Bottom"], "the newest answer first, then by name; never a plan row twice");
  assert.deepEqual(v.rest.map((r) => r.sub), ["nothing due · played yesterday", "nothing due"]);
  assert.equal(v.been, 3);
});

// L1-R1 (the reader of PR #434, its finding 1, measured: Jailbreak|Top, 3 cards 53 days overdue, read "nothing due" under
// the rule because the plan's day of 20 did not reach it): what is owed at a place is read for every row
test("a place that owes cards is never called nothing due: outside today's plan it sits above the rule with its count", () => {
  const owed = { "Mount|Bottom": 6, "Jailbreak|Top": 3, "Turtle|Bottom": 1, "Combat Base|Bottom": 0 };
  const v = ngMasterRows({ plan: [{ seat: "Mount|Bottom", due: 4 }], explored: ["Mount|Bottom", "Combat Base|Bottom", "Jailbreak|Top", "Turtle|Bottom"], resolve, day: DAY,
    lastDay: (k) => (k === "Jailbreak|Top" ? { day: DAY - 60, kind: "answered" } : null), owed: (k) => owed[k] });
  assert.deepEqual(v.rows.map((r) => [r.seat, r.sub]), [["Mount|Bottom", "6 due"]], "a plan place says what is owed there, as the plan counts it");
  assert.deepEqual(v.owing.map((r) => [r.seat, r.sub]), [["Jailbreak|Top", "3 due \u00b7 answered 2 months ago"], ["Turtle|Bottom", "1 due"]], "outside the plan, owing: above the rule, most owed first");
  assert.deepEqual(v.rest.map((r) => [r.seat, r.sub]), [["Combat Base|Bottom", "nothing due"]], "only a place that owes nothing says so");
  const unknown = ngMasterRows({ explored: ["Combat Base|Bottom"], resolve, day: DAY, owed: null });
  assert.equal(unknown.rest[0].sub, "", "no count known (the plan's game not in): nothing claimed");
});

// L1-R2 (the second reader of PR #434, its "unlisted owing place", 2 of 2; the orchestrator's ruling): the list's set is
// today's plan, the record's places and the places that owe a card. Every record from before `explored` was stored owes
// cards at places it does not hold.
test("every place that owes cards has a row, though it is in neither the record nor the plan; it is not a place you have been to", () => {
  const owed = { "Mount|Bottom": 4, "Jailbreak|Top": 3, "Turtle|Bottom": 1 };
  const v = ngMasterRows({ plan: [{ seat: "Mount|Bottom", due: 4 }], explored: ["Mount|Top"], resolve, day: DAY, owed: (k) => owed[k] || 0,
    owing: ["Mount|Bottom", "Turtle|Bottom", "Jailbreak|Top", "Gone|Top", "Hidden|Top"], today: (k) => (k === "Mount|Bottom" ? 2 : 0) });
  assert.deepEqual(v.owing.map((r) => [r.seat, r.sub]), [["Jailbreak|Top", "3 due"], ["Turtle|Bottom", "1 due"]], "the owing places the record does not hold, above the rule, most owed first");
  assert.deepEqual(v.rows.map((r) => r.seat), ["Mount|Bottom"], "a plan place is a row once");
  assert.deepEqual(v.rest.map((r) => r.seat), ["Mount|Top"]);
  assert.equal(v.been, 1, "`been` counts the record's places only: an owing place is not one you have been to");
  assert.equal(v.unresolved, 0, "an owing key that no longer resolves is not a lost place of the record (the record never held it)");
  assert.equal(v.rows[0].today, 2, "a row carries what was answered there today (the open place's figure)");
  const none = ngMasterRows({ plan: [], explored: [], resolve, day: DAY, owed: (k) => owed[k] || 0, owing: ["Jailbreak|Top"] });
  assert.deepEqual(none.owing.map((r) => r.seat), ["Jailbreak|Top"], "a record with no `explored` at all still lists what it owes");
  assert.equal(none.been, 0);
});

test("a key that no longer resolves is counted, never shown", () => {
  const v = ngMasterRows({ explored: ["Mount|Top", "Gone|Top", "Gone|Bottom", "Hidden|Top", "Kimura|Attacker"], resolve, day: DAY });
  assert.equal(v.unresolved, 2, "the two renamed seats are counted");
  assert.deepEqual(v.rest.map((r) => r.seat), ["Mount|Top"], "a seat this ruleset does not draw and a submission's side are not places");
  assert.equal(v.been, 1);
});

test("a row's number is the gold count, its marks at most eight", () => {
  const ten = Array.from({ length: 10 }, (_, i) => (i % 3 ? "dia" : "tri"));
  const v = ngMasterRows({ plan: [{ seat: "Mount|Top", due: 1 }], explored: ["Mount|Top", "Side Control|Top"], resolve, day: DAY,
    gold: (k) => (k === "Mount|Top" ? ten : []) });
  assert.equal(v.rows[0].n, 10);
  assert.deepEqual(v.rows[0].marks, ten.slice(0, 8));
  assert.equal(v.rest[0].n, 0, "a place with no gold has no marks and no number");
  assert.deepEqual(v.rest[0].marks, []);
});

test("a place you never stood on is marked new", () => {
  const v = ngMasterRows({ plan: [{ seat: "Mount|Bottom", fresh: 4 }, { seat: "Side Control|Bottom", due: 1 }, { seat: null, due: 2 }],
    explored: ["Side Control|Bottom"], resolve, day: DAY });
  assert.deepEqual(v.rows.map((r) => r.isNew), [true, false, false], "cards no position holds are not a place, so never new");
  assert.deepEqual(v.rows.map((r) => r.sub), ["new cards", "1 due", "2 due"]);
  assert.equal(v.rows[2].name, "Other cards");
});

test("a place with nothing left today says so", () => {
  const v = ngMasterRows({ plan: [{ seat: "Mount|Bottom", due: 0, fresh: 0 }], explored: ["Mount|Bottom"], resolve, day: DAY,
    lastDay: () => ({ day: DAY, kind: "answered" }) });
  assert.equal(v.rows[0].sub, "done for today · answered today");
});

test("when you last answered or played, in words", () => {
  const w = (n, kind = "answered") => ngMasterWhen({ day: DAY - n, kind }, DAY);
  assert.deepEqual([w(0), w(1), w(5), w(13), w(14), w(59), w(60), w(3, "played")],
    ["answered today", "answered yesterday", "answered 5 days ago", "answered 13 days ago", "answered 2 weeks ago", "answered 8 weeks ago", "answered 2 months ago", "played 3 days ago"]);
  assert.equal(ngMasterWhen(null, DAY), "", "no day: no words");
  assert.ok(!/visit/i.test(w(1) + w(1, "played")), "never the word visited (ruling 5)");
});

test("the button's words", () => {
  const first = { name: "Mount", side: "Bottom" };
  assert.deepEqual(ngMasterStart({ done: 0, goal: 20, first }), { met: false, title: "Start today's session", sub: "Mount, bottom first · 20 to go" });
  assert.deepEqual(ngMasterStart({ done: 7, goal: 20, first }), { met: false, title: "Continue today's session", sub: "Mount, bottom first · 13 to go" });
  assert.deepEqual(ngMasterStart({ done: 0, goal: 20, first, newPlayer: true }), { met: false, title: "Start today's session", sub: "Your first position: Mount, bottom" });
  assert.deepEqual(ngMasterStart({ done: 22, goal: 20, first }), { met: true, title: "Today's 20 are done", sub: "22 answered · keep going if you like" });
  assert.equal(ngMasterStart({ done: 0, first: null, ready: false }).sub, "Loading your positions…");
  assert.equal(ngMasterStart({ done: 0, first: null, ready: true }).sub, "Nothing to practise here right now.");
  assert.equal(ngMasterStart({ done: 3, goal: 20, first: { name: "Other cards", side: "" } }).sub, "Other cards first · 17 to go");
  // L1-R1: nothing left in the plan before the goal: the next round, never a finished place
  assert.deepEqual(ngMasterStart({ done: 2, goal: 20, first: null, ready: true, more: true }), { met: false, keep: true, title: "Keep practising", sub: "2 answered \u00b7 the next round, worth most first" });
  assert.equal(ngMasterStart({ done: 2, goal: 20, first: null, ready: true, more: false }).sub, "Nothing to practise here right now.", "no next round to deal: said so");
});

// L1-R1 (the reader of PR #434, its finding 6: an `explored` entry of 42, null or {} stopped the app before it drew, on dev
// v1.287.0 too): the loader takes strings only and counts the rest, which the list says with the places that no longer resolve
test("a damaged explored is read as its strings, the rest counted", () => {
  assert.deepEqual(ngProgressExploredKeys(["Mount|Top", 42, null, {}, "Side Control|Top"]), { keys: ["Mount|Top", "Side Control|Top"], bad: 3 });
  assert.deepEqual(ngProgressExploredKeys(undefined), { keys: [], bad: 0 }, "no record: no places, nothing counted");
  assert.deepEqual(ngProgressExploredKeys("Mount|Top"), { keys: [], bad: 0 }, "not a list: no places");
  // the record is not refused for it (the stored envelope was "invalid", and the app held before it drew)
  assert.doesNotThrow(() => ngProgressValidateBlob({ v: 2, explored: ["Mount|Top", 42, null, {}] }), "a damaged entry: the record is still read");
  assert.throws(() => ngProgressValidateBlob({ v: 2, explored: "Mount|Top" }), /Invalid explored history/, "not a list: still refused");
});
