import { test } from "node:test";
import assert from "node:assert/strict";
import { ngGameplanDebt as debt } from "../neural/src/gameplan-debt.src.js";
import { ngGameplanFromModel as fromModel, ngGameplanBuild as build, ngGameplanProgress as progress,
  ngGameplanBind as bind, ngGameplanSummary as summary } from "../neural/src/gameplan.src.js";

const day = 100;
const deck = (questions, extra = {}) => ({ questions, count: questions.length, exact: true, headroom: .15, allowed: true, ...extra });
const row = (key, score = 1, extra = {}) => ({ key, role: key.split("|")[1], status: "ready", exposure: .2, headroom: .15, score, reason: "Practice applies at this role's modeled opportunities.", ...extra });
const provider = (rows, extra = {}) => ({ kind: "learning-opportunity", status: "ready", stamp: "r1", assumptions: ["Standing start; gi; baseline max-win policy exposure; separately reoptimized study scenarios."], rows, ...extra });
const input = (extra = {}) => ({ day, revision: 1, stamp: "r1", ruleset: "gi", target: 30, ...extra });
const due = (age = 1) => [day - age, 3, day - age - 3];

test("due cover counts a shared question once; missing content and another ruleset retain debt", () => {
  const d = debt(input({ decks: { A: deck(["shared"]), B: deck(["shared", "b"], { allowed: false }) },
    srs: { A: { shared: due(5) }, B: { shared: due(2), b: due(1) }, missing: { lost: due(9) } } }));
  assert.equal(d.count, 3);
  assert.deepEqual(d.rows.map((r) => [r.key, r.questions]), [["A", ["shared"]], ["B", ["b"]]]);
  assert.deepEqual(d.blocked, ["lost"]);
});

test("old lesson credit never resolves debt; both real success and failure schedules do", () => {
  const decks = { "Mount|Top": deck(["a", "b"], { headroom: 0 }) };
  const p = build(input({ decks, srs: { "Mount|Top": { a: due(), b: due() } } }));
  assert.equal(progress(p, { day, decks, srs: { "Mount|Top": { a: due(), b: due() } } }).complete, false);
  const graded = { "Mount|Top": { a: [101, 1, 100], b: [107, 7, 100] } };
  assert.equal(progress(p, { day, decks, srs: graded }).complete, true);
  assert.equal(progress(p, { day, decks, srs: {} }).complete, false, "reset is not proof of reviewing");
});

test("due-overlapping recommendations are removed before dashboard/plan count and budget", () => {
  const decks = { "Mount|Top": deck(["a"]), "Mount|Bottom": deck(["a", "b"]), "Escape|Defender": deck(["b", "c"]) };
  const p = build(input({ decks, srs: { "Mount|Top": { a: due() } },
    provider: provider(Object.keys(decks).map((k, i) => row(k, 3 - i))) }));
  assert.deepEqual(p.due.map((r) => r.key), ["Mount|Top"]);
  assert.equal(p.fresh.length, 2);
  assert.equal(p.newCards, 2, "a and b are not charged twice");
  assert.equal(p.total, 3);
  assert.equal(new Set(p.due.concat(p.fresh).flatMap((r) => r.questions)).size, 3);
});

test("an eight-card first deck with five spaces explicitly exceeds the soft target", () => {
  const decks = { "Side Control|Top": deck(Array.from({ length: 8 }, (_, i) => "q" + i)) };
  const p = build(input({ target: 5, decks, provider: provider([row("Side Control|Top")]) }));
  assert.equal(p.fresh.length, 1); assert.equal(p.newCards, 8); assert.equal(p.overrun, 3);
  assert.match(summary(p), /runs 3 cards over the goal/);
});

// PRACTICE (owner U56 e, v1.242.0) reverses the v1.138.0 rule this test used to pin ("due debt consumes
// the target before new work", which dealt a heavy day no new card at all). Reviews still count toward
// the goal and are never capped; new cards keep one in five of what is left of the goal while it is unmet.
test("Practice: reviewed questions count toward the goal, due stays uncapped, and new cards keep their share", () => {
  const decks = { "A|Top": deck(["x", "y", "z"]), "B|Bottom": deck(["b"]) };
  const srs = { "A|Top": { x: due(), y: due(), z: [101, 1, 100] }, copy: { z: [101, 1, 100] } };
  const p = build(input({ target: 2, decks, srs, provider: provider([row("B|Bottom")]) }));
  assert.equal(p.reviewed.length, 1); assert.equal(p.dueCards, 2);
  assert.deepEqual(p.fresh.map((r) => r.key), ["B|Bottom"], "a fifth of the one card left of the goal, rounded up = one new card");
  assert.equal(p.overrun, 2); assert.equal(p.more.length, 0);
});

// The three Practice claims, at the planner. Mutants recorded in tests/artifacts/sidebar_mutants.md.
const ten = (prefix) => Array.from({ length: 10 }, (_, i) => prefix + i);
const practiceDecks = () => ({ ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["D" + i + "|Top", deck(["d" + i])])),
  "N1|Top": deck(["n1a", "n1b"]), "N2|Bottom": deck(["n2a", "n2b"]), "N3|Attacker": deck(["n3a"]), "N4|Defender": deck(ten("n4")) });
const ranked = () => provider(["N1|Top", "N2|Bottom", "N3|Attacker", "N4|Defender"].map((k, i) => row(k, 9 - i)));

test("Practice: a fresh player's session is the gaps, up to the 20-card default goal", () => {
  const p = build({ day, revision: 1, stamp: "r1", ruleset: "gi", decks: practiceDecks(), provider: ranked() });
  assert.equal(p.target, 20, "the default goal is 20 cards");
  assert.equal(p.dueCards, 0);
  assert.deepEqual(p.queue, ["N1|Top", "N2|Bottom", "N3|Attacker", "N4|Defender"], "new gap decks fill the goal, in rank order");
  assert.equal(p.newCards, 15);
});

test("Practice: due reviews come first by urgency, and new decks are slipped in at one card per four reviews", () => {
  const decks = practiceDecks();
  // twelve one-card reviews, the oldest first (D0 is twelve days overdue, D11 one)
  const srs = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["D" + i + "|Top", { ["d" + i]: due(12 - i) }]));
  const p = build(input({ target: 20, decks, srs, provider: ranked() }));
  assert.equal(p.dueCards, 12); assert.equal(p.newCards, 5, "8 left of the goal buys N1 + N2 + N3; N4's ten cards wait");
  assert.deepEqual(p.queue, ["D0|Top", "D1|Top", "D2|Top", "D3|Top", "N1|Top", "D4|Top", "D5|Top", "D6|Top", "D7|Top", "D8|Top", "D9|Top", "D10|Top", "D11|Top", "N2|Bottom", "N3|Attacker"],
    "four reviews before the first new card; N1's two cards cost eight more before N2; the rest follow the reviews");
  assert.deepEqual(p.queue.filter((k) => k[0] === "D"), p.due.map((r) => r.key), "reviews keep the debt's urgency order");
});

test("Practice: a heavy day keeps the mix without capping reviews; the goal stops new cards, never reviews", () => {
  const decks = practiceDecks();
  const srs = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["D" + i + "|Top", { ["d" + i]: due(1) }]));
  const heavy = build(input({ target: 10, decks, srs, provider: ranked() }));
  assert.equal(heavy.due.length, 12, "all twelve reviews, past a ten-card goal");
  assert.deepEqual(heavy.fresh.map((r) => r.key), ["N1|Top"], "a fifth of the ten-card goal = 2 new cards: N1's two fill it; N2 waits");
  assert.deepEqual(heavy.queue.slice(0, 5), heavy.due.slice(0, 4).map((r) => r.key).concat("N1|Top"), "and the new deck is mixed in, not appended");
  // the goal already met today: nothing new is dealt, every review still is
  const answered = Object.fromEntries(ten("t").map((q) => [q, [day + 1, 1, day]]));
  const met = build(input({ target: 10, decks, srs: { ...srs, done: answered }, provider: ranked() }));
  assert.equal(met.reviewed.length, 10); assert.equal(met.fresh.length, 0); assert.equal(met.due.length, 12);
  assert.deepEqual(met.queue, met.due.map((r) => r.key));
});

// THE QUOTA NEVER CLIMBS BACK UP (SIDE-R2 M2). The first curve gave 16 owed reviews 4 new cards and 77 owed
// the whole goal again; the floor is now one in five of what is left of the goal. The curve is the owner's
// number (U63): this pins its SHAPE, and the heavy-day floor it has today.
// SIDE-R3 N5: all 303 points, including the seven cards left after 13 real answers. Mutations that
// dip only at due=21 for left=20 or left=7 both die at due=22; the old 13 samples missed that gap.
test("Practice: the new-card quota is non-increasing over due 0..100 with 20, 7 and 60 left", () => {
  let points = 0;
  for (const [target, answered] of [[20, 0], [20, 13], [60, 0]]) {
    const left = target - answered, rooms = [];
    for (let owed = 0; owed <= 100; owed++) {
      const keys = Array.from({ length: owed }, (_, i) => "D" + i + "|Top");
      const decks = Object.fromEntries(keys.map((k, i) => [k, deck(["d" + i])]));
      const srs = Object.fromEntries(keys.map((k, i) => [k, { ["d" + i]: due(1) }]));
      srs.done = Object.fromEntries(Array.from({ length: answered }, (_, i) => ["answered" + i, [day + 1, 1, day]]));
      const p = build(input({ target, decks, srs, provider: provider([]) }));
      assert.equal(p.dueCards, owed);
      assert.equal(p.reviewed.length, answered);
      rooms.push(p.room); points++;
    }
    for (let i = 1; i < rooms.length; i++) assert.ok(rooms[i] <= rooms[i - 1], `left=${left} due=${i}: ${rooms[i - 1]} -> ${rooms[i]}`);
    const floor = Math.ceil(left / 5);
    assert.deepEqual([rooms[0], rooms[left - floor], rooms.at(-1)], [left, floor, floor], "U63 a: one in five of the remaining goal on a heavy day");
  }
  console.log("Practice quota: " + points + " planner points asserted");
});

// THE MIX IS DECK-GRANULAR (SIDE-R2 M1). Real decks run a median of 8 cards (p90 10), so a whole deck is
// dealt at its turn and the copy says "a new technique after every few reviews". What the queue keeps at
// that granularity: each new deck is placed only once the reviews before it pay four cards for every new
// card before it, plus one; reviews keep their urgency order; no two new decks meet while reviews remain.
test("Practice: with real 8-card decks a new technique comes after every few reviews, never two in a row while reviews remain", () => {
  const owed = Array.from({ length: 40 }, (_, i) => "D" + i + "|Top"), fresh = ["N0|Top", "N1|Top", "N2|Top", "N3|Top"];
  const decks = { ...Object.fromEntries(owed.map((k, i) => [k, deck(["d" + i])])),
    ...Object.fromEntries(fresh.map((k, i) => [k, deck(Array.from({ length: 8 }, (_, j) => "n" + i + "-" + j))])) };
  const srs = Object.fromEntries(owed.map((k, i) => [k, { ["d" + i]: due(40 - i) }]));
  const p = build(input({ target: 60, decks, srs, provider: provider(fresh.map((k, i) => row(k, 9 - i))) }));
  assert.equal(p.room, 20); assert.deepEqual(p.fresh.map((r) => r.key), ["N0|Top", "N1|Top"], "two whole 8-card decks fit 20; the third waits");
  assert.equal(p.queue.indexOf("N0|Top"), 4, "the first new technique follows four reviews");
  assert.equal(p.queue.indexOf("N1|Top"), 37, "the next waits until 36 reviews have paid for N0's eight cards");
  let reviews = 0, learned = 0;
  p.queue.forEach((k, i) => {
    if (k[0] === "D") { reviews++; return; }
    assert.ok(reviews >= 4 * (learned + 1), k + " placed after only " + reviews + " reviews for " + learned + " new cards");
    assert.ok(i + 1 === p.queue.length || p.queue[i + 1][0] === "D" || !p.queue.slice(i).some((x) => x[0] === "D"), "two new decks meet while reviews remain");
    learned += 8;
  });
  assert.deepEqual(p.queue.filter((k) => k[0] === "D"), p.due.map((r) => r.key));
});

test("all four roles are independent opportunities; illegal new decks are excluded in each frame", () => {
  for (const ruleset of ["gi", "nogi"]) {
    const keys = ["Mount|Top", "Mount|Bottom", "Move|Attacker", "Move|Defender"];
    const decks = Object.fromEntries(keys.map((k) => [k, deck([k])]));
    decks["Lapel|Attacker"] = deck(["lapel"], { allowed: ruleset === "gi" });
    const p = build(input({ ruleset, decks, provider: provider(Object.keys(decks).map((k) => row(k))) }));
    assert.equal(p.fresh.length, ruleset === "gi" ? 5 : 4);
    for (const key of keys) assert.ok(p.fresh.some((r) => r.key === key), key);
  }
});

test("missing, loading, stale, partial defense and genuinely exhausted coverage are distinct", () => {
  const decks = { "Move|Defender": deck(["d"]) };
  assert.equal(build(input({ decks })).status, "unavailable");
  assert.equal(build(input({ decks, provider: { status: "pending" } })).status, "pending");
  assert.equal(build(input({ decks, provider: provider([], { stamp: "old" }) })).status, "stale");
  const partial = build(input({ decks, provider: provider([]) }));
  assert.equal(partial.status, "partial"); assert.deepEqual(partial.missing, ["Move|Defender"]);
  assert.match(summary(partial), /does not mean you've mastered them/);
  assert.equal(build(input({ decks, provider: provider([row("Move|Defender", 0)]) })).status, "exhausted");
});

test("high action values, absent exposure, wrong role and no headroom cannot become study value", () => {
  const decks = { "Move|Defender": deck(["d"]), "Cap|Top": deck(["cap"], { headroom: 0 }) };
  for (const r of [row("Move|Defender", 999, { exposure: undefined }), row("Move|Defender", 999, { role: "Attacker" }),
    row("Move|Defender", 999, { exposure: 0 }), row("Move|Defender", 999, { headroom: .30 })]) {
    assert.equal(build(input({ decks, provider: provider([r, row("Cap|Top", 999)]) })).fresh.length, 0);
  }
  assert.equal(build(input({ decks, provider: provider([row("Move|Defender")], { kind: "action-value" }) })).status, "stale");
});

test("the snapshot freezes ranking, reasons and input values while new debt stays current", () => {
  const decks = { "Move|Attacker": deck(["a"]), "Move|Defender": deck(["d"]) };
  const data = provider([row("Move|Attacker", 2), row("Move|Defender", 1)]);
  const p = build(input({ decks, provider: data }));
  data.rows[0].reason = "changed"; data.rows.reverse();
  assert.equal(p.fresh[0].key, "Move|Attacker"); assert.notEqual(p.fresh[0].reason, "changed");
  assert.ok(Object.isFrozen(p.fresh[0]));
  const live = progress(p, { day, decks, srs: { extra: { later: due() } } });
  assert.deepEqual(live.newDebt, ["later"]); assert.equal(live.complete, false);
  assert.equal(p.dueCards, 0);
});

test("day rollover invalidates completion even when all prior-day work was reviewed", () => {
  const decks = { "A|Top": deck(["a"]) }, srs = { "A|Top": { a: due() } };
  const p = build(input({ decks, srs }));
  const next = { "A|Top": { a: [101, 1, 100] } };
  const now = progress(p, { day: 101, decks, srs: next });
  assert.equal(now.dayChanged, true); assert.equal(now.complete, false); assert.equal(now.dueCards, 1);
  assert.equal(progress(p, { day: 101, decks, srs: { "A|Top": { a: [107, 7, 100] } } }).complete, false,
    "a prior-day plan does not claim completion on a new day without debt");
});

test("manifest question counts bind on hydration without reordering or duplicate shared assignments", () => {
  const decks = { "A|Top": deck(["s"], { count: 3, exact: false }), "B|Bottom": deck(["s"], { count: 2, exact: false }) };
  const p = build(input({ decks, provider: provider([row("A|Top", 2), row("B|Bottom", 1)]) }));
  assert.equal(p.newCards, 4);
  assert.equal(progress(p, { day, decks, srs: {} }).complete, false);
  const hydrated = { "A|Top": deck(["s", "a1", "a2"]), "B|Bottom": deck(["s", "b"]) };
  const bound = bind(p, hydrated);
  assert.deepEqual(bound.fresh.map((r) => r.key), p.fresh.map((r) => r.key));
  assert.equal(bound.newCards, 4); assert.deepEqual(bound.fresh[1].questions, ["b"]);
  assert.ok(p.fresh[0].pending > 0, "binding does not mutate the source snapshot");
});

test("shared review in another deck resolves the selected question; deleted orphan debt does not", () => {
  const decks = { "A|Top": deck(["a"]) };
  const p = build(input({ decks, srs: { "A|Top": { a: due() }, ghost: { g: due() } } }));
  assert.equal(progress(p, { day, decks, srs: { other: { a: [101, 1, 100] } } }).complete, false);
  const done = progress(p, { day, decks, srs: { other: { a: [101, 1, 100], g: [101, 1, 100] } } });
  assert.equal(done.complete, true); assert.equal(done.completed, done.total);
});

test("a removed question in an existing deck remains explicitly blocked review debt", () => {
  const decks = { "A|Top": deck(["present"]) }, srs = { "A|Top": { removed: due() } };
  const p = build(input({ decks, srs }));
  const live = progress(p, { day, decks, srs });
  assert.equal(live.complete, false); assert.equal(live.dueCards, 1);
  assert.deepEqual(live.blocked, ["removed"]);
  assert.equal(p.due.length, 0, "an unopenable question does not become an empty review row");
  const shared = build(input({ decks: { ...decks, "B|Bottom": deck(["removed"]) },
    srs: { ...srs, "B|Bottom": { removed: due(0) } } }));
  assert.deepEqual(shared.due.map((r) => r.key), ["B|Bottom"]);
  assert.deepEqual(shared.blocked, []);
});

test("deduping identical role decks retains the other role's reason", () => {
  const decks = { "Mount|Top": deck(["s"]), "Mount|Bottom": deck(["s"]) };
  const p = build(input({ decks, provider: provider([row("Mount|Top", 2), row("Mount|Bottom", 1)]) }));
  assert.equal(p.newCards, 1); assert.equal(p.fresh.length, 1);
  assert.deepEqual(p.fresh[0].related.map((r) => r.role), ["Bottom"]);
});

test("model consumer ranks a joint scenario without adding its per-deck gain or inventing defense exposure", () => {
  const modelStamp = { contractHash: "full", profileHash: "p0", ruleset: "nogi", horizon: { kind: "actual-roll", episodeCap: 10, moveCount: 2 } };
  const context = { stamp: "r1", modelStamp, startDistribution: [{ stateId: "guard/bottom", probability: 1 }], exposurePolicyId: "baseline-policy" };
  const result = { apiVersion: 1, status: "partial", stamp: modelStamp, startDistribution: context.startDistribution,
    exposurePolicyId: context.exposurePolicyId, policySemantics: "reoptimized", scenarios: [{ id: "joint", status: "ready",
      simulatedWinDelta: .02, baselinePolicyId: "baseline-policy", scenarioPolicyId: "joint-policy",
      deckKeys: [{ deckKey: "Move|Attacker", role: "Attacker", headroom: .03 }, { deckKey: "Move|Defender", role: "Defender", headroom: .06 }],
      exposure: [{ deckKey: "Move|Attacker", role: "Attacker", status: "ready", kind: "expected-visits", value: .4 },
        { deckKey: "Move|Defender", role: "Defender", status: "unavailable", reason: "no defense coverage" }] }] };
  const providerResult = fromModel(result, context);
  assert.equal(providerResult.rows.length, 1); assert.equal(providerResult.rows[0].score, .02);
  assert.match(providerResult.assumptions.join(" "), /before and after practising the material together/);
  // item 9 (owner, 2026-09-30): ONE plain sentence per card; the caveats are the assumptions' job.
  assert.equal(providerResult.rows[0].reason, "Practising this could win you more games when attacking, from your chosen starts.");
  assert.equal(providerResult.diagnostics, result, "formal evidence stays in diagnostics");
  const p = build(input({ decks: { "Move|Attacker": deck(["a"]), "Move|Defender": deck(["d"]) }, provider: providerResult }));
  assert.deepEqual(p.missing, ["Move|Defender"]); assert.equal(p.status, "partial");
  for (const changed of [{ stamp: { ...modelStamp, profileHash: "p1" } }, { startDistribution: [{ stateId: "guard/top", probability: 1 }] },
    { exposurePolicyId: "other-policy" }, { policySemantics: "mixed" }]) {
    assert.equal(fromModel({ ...result, ...changed }, context).status, "unavailable");
  }
});

// D1 (owner, 2026-09-30): "when no study comparison exists, fall back to the weak-spots ranking so every
// player, a new one included, always has a plan". The fallback ranks ONLY when the comparison cannot
// (unavailable / pending / stale), keeps its order, passes the same deck gate, and says what it is.
// Mutant, recorded 2026-09-30: dropping the fallback line in ngGameplanBuild turns this red (a new
// player's plan is empty again).
test("D1: with no comparison the weak-spots ranking fills the plan, in order, and says so", () => {
  const decks = { "Mount|Top": deck(["m1", "m2"]), "Guard|Bottom": deck(["g1"]), "Lapel|Attacker": deck(["l"], { allowed: false }),
    "Capped|Top": deck(["c"], { headroom: 0 }), "Empty|Top": deck([], { count: 0 }), "Due|Top": deck(["d"]) };
  const fallback = { rows: ["Guard|Bottom", "Lapel|Attacker", "Capped|Top", "Empty|Top", "Due|Top", "Mount|Top"].map((key) => ({ key, reason: "Weak: " + key })),
    assumptions: ["Weak spots rank each technique."] };
  const srs = { "Due|Top": { d: due() } };
  for (const provided of [undefined, { status: "pending" }, provider([], { stamp: "old" })]) {
    const p = build(input({ decks, srs, provider: provided, fallback }));
    assert.equal(p.status, "weak-spots"); assert.ok(["unavailable", "pending", "stale"].includes(p.comparison));
    assert.deepEqual(p.fresh.map((r) => r.key), ["Guard|Bottom", "Mount|Top"], "ranked order kept; illegal, capped, empty and due decks gated");
    assert.equal(p.fresh[0].reason, "Weak: Guard|Bottom"); assert.deepEqual(p.assumptions, fallback.assumptions);
    assert.match(summary(p), /weakest spots first/);
  }
  // A comparison that exists, even an empty one, is never replaced by the fallback.
  const ready = build(input({ decks, provider: provider([row("Mount|Top")]), fallback }));
  assert.equal(ready.status, "partial", "a comparison that covers only some decks is still a comparison"); assert.deepEqual(ready.fresh.map((r) => r.key), ["Mount|Top"]);
  assert.equal(build(input({ decks: { "Move|Defender": deck(["x"]) }, provider: provider([row("Move|Defender", 0)]), fallback })).status, "exhausted");
  // A tight budget sends the rest of the ranking to `more`, the extra list the session keeps locked.
  const tight = build(input({ target: 2, decks, srs, fallback }));
  assert.deepEqual(tight.fresh.map((r) => r.key), ["Guard|Bottom"]); assert.deepEqual(tight.more.map((r) => r.key), ["Mount|Top"]);
});
