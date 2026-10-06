// THE ADAPTER PRICES AND DRAWS A LISTING'S OWN TABLE, AND NEVER LETS IT LEAK (v1.214.0, PR B1).
// Asked for by the full-game seat's review (OCPRB1-FG item 2): with zero tables in production the
// byte-identity proof cannot see the adapter's new paths (CLAUDE.md 6.3, 6.9), so this synthetic graph
// carries ONE listing table. One transition `tA` has a canonical table at its origin and its own table
// at a listing (cal.at.listing):
//   (a) at the listing, the action prices from the listing's rate and lands where the listing's table
//       says;
//   (b) at the origin, the same technique prices and lands from its canonical table;
//   (c) alternating origin/listing calls each return their own chance and their own destinations, so
//       no cache hands one state the other's answer.
// MUTANTS (measured at v1.214.0):
//   - actAt returning node(id) (no overlay): (a) red;
//   - `act.here` dropped from the rows()/weightedRows() cache keys: (c) red (the listing gets the
//     origin's rows, or the reverse, depending on call order);
//   - `act.here` dropped from the moveChance cache key: SURVIVES, and is EQUIVALENT by construction:
//     chanceContextKey already carries s.nodeId, and `here` is a function of the state, so two calls
//     that share that key share `here`. Recorded so nobody reads this file as covering it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const M = new Function("module", "require", read("neural/src/mdp-identity.src.js") + "\n" + read("neural/src/mdp-model.src.js") +
  "\nconst core=module.exports;\n" + read("neural/src/mdp-adapter.src.js") + "\nreturn {...core,...module.exports};")(
  { exports: {} }, createRequire(new URL("../neural/src/mdp-model.src.js", import.meta.url)));
const K = await import("data:text/javascript;base64," + Buffer.from(read("neural/src/knowledge-profile.src.js")).toString("base64"));

function setup() {
  const pos = (id, t, role, pair, posId) => ({ id, t, ty: "positions", role, pairId: pair, posId, deckKey: t + "|" + (role === "top" ? "Top" : "Bottom"), s: [0.1, -0.1] });
  const nodes = [
    pos("oT", "Origin Top", "top", "oB", "origin"), pos("oB", "Origin Top", "bottom", "oT", "origin"),
    pos("lT", "Listing Top", "top", "lB", "listing"), pos("lB", "Listing Top", "bottom", "lT", "listing"),
    { id: "tA", t: "Transition", ty: "transitions", role: "attacker", fromRole: "top", fromPositionId: "origin",
      alsoFrom: ["listing"], deckKey: "Transition|Attacker", s: [0.1, -0.1],
      cal: { successRate: 60, outcomes: [{ probability: 60, result: "success", to: "origin/top" }, { probability: 40, result: "failure", to: "origin/bottom" }],
        at: { listing: { successRate: 30, outcomes: [{ probability: 30, result: "success", to: "listing/top" }, { probability: 70, result: "failure", to: "listing/bottom" }] } } } },
  ].map((n) => ({ allowed: true, dom: 0, poolName: n.t.toLowerCase(), ...n }));
  const hands = {};
  hands[M.ngMdpStable(["oT", "top"])] = [{ techniqueId: "tA", kind: "transition", destinationId: "oT" }];
  hands[M.ngMdpStable(["lT", "top"])] = [{ techniqueId: "tA", kind: "transition", destinationId: "lT" }];
  for (const p of ["oT", "oB", "lT", "lB"]) for (const r of ["top", "bottom"]) hands[M.ngMdpStable([p, r])] = hands[M.ngMdpStable([p, r])] || [];
  const dest = (nodeId, role) => ({ nodeId, role, terminal: false });
  const graph = { version: 1, ruleset: "nogi", evFrame: "nogi", nodes, hands, evHands: {}, canonical: {}, deckReady: {},
    destinations: { "game-over": { terminal: true, nodeId: null, role: null }, "origin/top": dest("oT", "top"), "origin/bottom": dest("oB", "bottom"),
      "listing/top": dest("lT", "top"), "listing/bottom": dest("lB", "bottom") }, coverage: { status: "COMPLETE" } };
  const profile = K.ngKnowledgeBuildProfile({ prep: {}, sharp: {} });
  const adapter = M.ngMdpCreateGameAdapter(graph, profile, K);
  const at = (nodeId) => {
    const snapshot = { nodeId, role: "top", phase: "user", moveCount: 1, arrivalAge: 0, qMod: 0, combo: 0, positionKey: null, panicKey: null, aiSkill: 0.1 };
    const request = { apiVersion: 2, requestId: "r", revision: 1, modelHash: "model", mechanicsHash: "law", graphHash: "graph", profileHash: profile.fingerprint,
      opponentPolicyHash: "opponent", ruleset: "nogi", state: { id: "", snapshot, aiSkill: 0.1 }, horizon: { kind: "actual-roll", episodeCap: 9, moveCount: 1 },
      objective: "max-win/min-loss/min-nontermination", futureStudyPolicy: "no-additional-study-events" };
    request.state.id = adapter.stateId(snapshot, request);
    const action = adapter.enumerate(snapshot, request).actions.find((a) => a.kind === "transition");
    const lands = action.branches.map((b) => (b.next && b.next.nodeId) || b.terminal || null).sort();
    return { chance: action.immediateExecutionChance, lands };
  };
  return { at };
}

test("a listing's own table prices and lands at the listing; the origin keeps its canonical table; neither leaks", () => {
  const { at } = setup();
  const listing = at("lT"), origin = at("oT");
  // (a) the listing prices from ITS rate (30 against the origin's 60) and lands where its table says
  assert.ok(listing.chance < origin.chance, `listing ${listing.chance} prices below origin ${origin.chance}`);
  assert.ok(listing.lands.every((id) => id === "lT" || id === "lB"), "the listing's table lands at the listing: " + listing.lands);
  // (b) the origin prices and lands from the canonical table
  assert.ok(origin.lands.every((id) => id === "oT" || id === "oB"), "the origin's table lands at the origin: " + origin.lands);
  // (c) alternating calls: every answer is its own state's, whatever was asked just before
  for (let i = 0; i < 3; i++) {
    const o = at("oT"), l = at("lT");
    assert.deepEqual(o, origin, "origin after listing, round " + i);
    assert.deepEqual(l, listing, "listing after origin, round " + i);
  }
});
