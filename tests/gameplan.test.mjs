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
  assert.match(summary(p), /exceed it by 3/);
});

test("reviewed unique questions and uncapped due debt consume the target before new work", () => {
  const decks = { "A|Top": deck(["x", "y", "z"]), "B|Bottom": deck(["b"]) };
  const srs = { "A|Top": { x: due(), y: due(), z: [101, 1, 100] }, copy: { z: [101, 1, 100] } };
  const p = build(input({ target: 2, decks, srs, provider: provider([row("B|Bottom")]) }));
  assert.equal(p.reviewed.length, 1); assert.equal(p.dueCards, 2);
  assert.equal(p.fresh.length, 0); assert.equal(p.overrun, 1); assert.equal(p.more.length, 1);
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
  assert.match(summary(partial), /does not mean mastered/);
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
  assert.match(providerResult.assumptions.join(" "), /before and after practicing this material together/);
  assert.equal(providerResult.diagnostics, result, "formal evidence stays in diagnostics");
  const p = build(input({ decks: { "Move|Attacker": deck(["a"]), "Move|Defender": deck(["d"]) }, provider: providerResult }));
  assert.deepEqual(p.missing, ["Move|Defender"]); assert.equal(p.status, "partial");
  for (const changed of [{ stamp: { ...modelStamp, profileHash: "p1" } }, { startDistribution: [{ stateId: "guard/top", probability: 1 }] },
    { exposurePolicyId: "other-policy" }, { policySemantics: "mixed" }]) {
    assert.equal(fromModel({ ...result, ...changed }, context).status, "unavailable");
  }
});
