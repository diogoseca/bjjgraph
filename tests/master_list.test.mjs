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
import { test } from "node:test";
import assert from "node:assert/strict";
import { ngMasterRows, ngMasterStart, ngMasterWhen } from "../neural/src/master-list.src.js";

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
    lastDay: (k) => (k === "Back Control|Bottom" ? { day: DAY - 1, kind: "played" } : null) });
  assert.deepEqual(v.rest.map((r) => r.seat), ["Back Control|Bottom", "Combat Base|Bottom"], "the newest answer first, then by name; never a plan row twice");
  assert.deepEqual(v.rest.map((r) => r.sub), ["nothing due · played yesterday", "nothing due"]);
  assert.equal(v.been, 3);
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
});
